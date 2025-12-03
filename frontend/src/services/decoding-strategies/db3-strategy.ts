import { UniversalHttpReader } from '@common/universal-http-reader';
import { parse as parseMessageDefer } from '@foxglove/rosmsg';
import { MessageReader as Ros1Reader } from '@foxglove/rosmsg-serialization';
import { MessageReader as CdrReader } from '@foxglove/rosmsg2-serialization';
import * as fzstd from 'fzstd';
import lz4js from 'lz4js';
import initSqlJs, { Database } from 'sql.js';
import { DecodingStrategy } from './index';
import { LogMessage, STANDARD_ROS2_DEFINITIONS } from './utilities';

export class Db3Strategy extends DecodingStrategy {
    private db: Database | null = null;
    private definitions = new Map<string, any>(); // key: topic_type
    private decoders = new Map<string, any>(); // key: topic_type

    async init(httpReader: UniversalHttpReader): Promise<void> {
        // sql.js requires the whole file in memory
        const data = await httpReader.read(0n, BigInt(httpReader.sizeBytes));

        const SQL = await initSqlJs({
            locateFile: () =>
                'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm',
        });

        this.db = new SQL.Database(data);

        // Try to load definitions from 'schemas' table if it exists
        try {
            const schemasStmt = this.db.prepare(
                'SELECT name, data FROM schemas',
            );
            while (schemasStmt.step()) {
                const row = schemasStmt.getAsObject();
                const name = row.name as string;
                const row_data = row.data as string;

                if (name && row_data) {
                    try {
                        const parsedDefs = parseMessageDefer(row_data);
                        this.definitions.set(name, parsedDefs);
                    } catch (error) {
                        console.warn(
                            `Failed to parse schema definition for ${name}`,
                            error,
                        );
                    }
                }
            }
            schemasStmt.free();
        } catch {
            // schemas table might not exist, which is standard for rosbag2
        }
    }

    async getMessages(
        topic: string,
        limit = 10,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        startTime?: bigint,
    ): Promise<LogMessage[]> {
        if (!this.db) return [];

        // Find topic_id
        const topicStmt = this.db.prepare(
            'SELECT id, type, serialization_format FROM topics WHERE name = :name',
        );
        topicStmt.bind({ ':name': topic });

        if (!topicStmt.step()) {
            topicStmt.free();
            return [];
        }

        const topicRow = topicStmt.getAsObject();
        const topicId = topicRow.id;
        const topicType = topicRow.type as string;
        const serializationFormat = topicRow.serialization_format as string;
        topicStmt.free();

        // Check for compression column in messages table
        let compressionCol: string | null = null;
        try {
            const tableInfoStmt = this.db.prepare(
                "PRAGMA table_info('messages')",
            );
            while (tableInfoStmt.step()) {
                const row = tableInfoStmt.getAsObject();
                if (row.name === 'compression_format') {
                    compressionCol = 'compression_format';
                    break;
                } else if (row.name === 'compression') {
                    compressionCol = 'compression';
                    break;
                }
            }
            tableInfoStmt.free();
        } catch {
            // Ignore error
        }

        // Prepare query
        let query = `SELECT CAST(timestamp AS TEXT) as timestamp_str, data`;
        if (compressionCol) {
            query += `, ${compressionCol} as compression`;
        }
        query += ` FROM messages WHERE topic_id = ${topicId}`;

        if (startTime !== undefined) {
            query += ` AND timestamp >= ${startTime}`;
        }
        query += ` ORDER BY timestamp ASC LIMIT ${limit}`;

        const stmt = this.db.prepare(query);
        const msgs: LogMessage[] = [];

        while (stmt.step()) {
            if (signal?.aborted) break;
            const row = stmt.getAsObject();
            const timestamp = BigInt(row.timestamp_str as string);
            let data = row.data as Uint8Array;

            // Handle decompression
            if (compressionCol && row.compression) {
                const compression = row.compression as string;
                try {
                    if (compression === 'zstd') {
                        data = fzstd.decompress(data);
                    } else if (compression === 'lz4') {
                        data = lz4js.decompress(data);
                    }
                } catch (error) {
                    console.warn(
                        `Failed to decompress message with format ${compression}`,
                        error,
                    );
                }
            }

            const decoded =
                (await this.tryDecode(topicType, serializationFormat, data)) ??
                data;

            const messageObject = { logTime: timestamp, data: decoded };
            if (onMessage) onMessage(messageObject);
            msgs.push(messageObject);
        }
        stmt.free();
        return msgs;
    }

    private tryDecode(type: string, format: string, data: Uint8Array): any {
        // Check cache first
        if (this.decoders.has(type)) {
            return this.decoders.get(type).readMessage(data);
        }

        // If not in cache, check definitions or standard definitions
        let defs = this.definitions.get(type);

        if (!defs && STANDARD_ROS2_DEFINITIONS[type]) {
            try {
                defs = parseMessageDefer(STANDARD_ROS2_DEFINITIONS[type]);
                this.definitions.set(type, defs);
            } catch (error) {
                console.warn(
                    `Failed to parse standard definition for ${type}`,
                    error,
                );
            }
        }

        if (defs) {
            let decoder;

            if (
                ['cdr', 'cdr_le', 'cdr_be', 'ros2', 'ros2msg'].includes(format)
            ) {
                decoder = new CdrReader(defs);
            } else if (['ros1', 'ros1msg'].includes(format)) {
                decoder = new Ros1Reader(defs);
            } else {
                // Default to CDR for DB3
                decoder = new CdrReader(defs);
            }

            this.decoders.set(type, decoder);
            return decoder.readMessage(data);
        }

        return undefined;
    }
    override getSchema(): string {
        if (!this.db) return '';
        const stmt = this.db.prepare(
            "SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL",
        );
        const schemas: string[] = [];
        while (stmt.step()) {
            schemas.push(stmt.getAsObject().sql as string);
        }
        stmt.free();
        return schemas.join(';\n\n');
    }
}
