import { Bag } from '@foxglove/rosbag';
import { FileEventEntity } from '@kleinkram/backend-common/entities/file/file-event.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { UniversalHttpReader } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fsPromises from 'node:fs/promises';
import { Repository } from 'typeorm';
import { AbstractMetadataService } from './abstract-metadata.service';
import { ExtractedTopicInfo } from './file-handler.interface';

/**
 * Interface compatible with @foxglove/rosbag BagReader
 */
interface BagReader {
    read(offset: number, length: number): Promise<Uint8Array>;
    size(): number;
}

/**
 * Adapter for Node.js fs handles
 */
class LocalBagReader implements BagReader {
    constructor(
        private handle: fsPromises.FileHandle,

        private _size: number,
    ) {}
    async read(offset: number, length: number): Promise<Uint8Array> {
        const buffer = new Uint8Array(length);
        await this.handle.read(buffer, 0, length, offset);
        return buffer;
    }
    size(): number {
        return this._size;
    }
}

/**
 * Adapter for UniversalHttpReader (streaming from s3)
 */
class HttpBagReader implements BagReader {
    constructor(private reader: UniversalHttpReader) {}

    async read(offset: number, length: number): Promise<Uint8Array> {
        // Convert number to bigint for UniversalHttpReader
        return await this.reader.read(BigInt(offset), BigInt(length));
    }

    size(): number {
        return this.reader.sizeBytes;
    }
}

@Injectable()
export class RosBagMetadataService extends AbstractMetadataService {
    constructor(
        @InjectRepository(TopicEntity) topicRepo: Repository<TopicEntity>,
        @InjectRepository(FileEntity) fileRepo: Repository<FileEntity>,
        @InjectRepository(FileEventEntity)
        fileEventRepo: Repository<FileEventEntity>,
    ) {
        super(topicRepo, fileRepo, fileEventRepo);
    }

    /**
     * Streams metadata directly from a presigned URL
     */
    async extractFromUrl(
        presignedUrl: string,
        targetEntity: FileEntity,
        actor?: UserEntity,
    ): Promise<void> {
        const startTime = Date.now();
        const httpReader = new UniversalHttpReader(presignedUrl);
        await httpReader.init();

        const bagReader = new HttpBagReader(httpReader);
        await this.processBag(
            bagReader,
            targetEntity,
            startTime,
            actor,
            'rosbag_url_stream',
        );
    }

    /**
     * Extracts metadata from a local file path
     */
    async extractFromLocalFile(
        filePath: string,
        targetEntity: FileEntity,
        actor?: UserEntity,
    ): Promise<void> {
        const startTime = Date.now();
        const handle = await fsPromises.open(filePath, 'r');
        try {
            const stat = await handle.stat();
            const bagReader = new LocalBagReader(handle, stat.size);
            await this.processBag(
                bagReader,
                targetEntity,
                startTime,
                actor,
                'rosbag_local_stream',
            );
        } finally {
            await handle.close();
        }
    }

    /**
     * Shared logic for processing the bag structure
     */
    private async processBag(
        bagReader: BagReader,
        targetEntity: FileEntity,
        startTime: number,
        actor: UserEntity | undefined,
        method: string,
    ): Promise<void> {
        const bag = new Bag(bagReader);
        await bag.open();

        const rawTopics: ExtractedTopicInfo[] = [];
        const connectionCounts = new Map<number, number>();

        // Sum counts from ChunkInfos (Efficient count extraction)
        for (const chunk of bag.chunkInfos) {
            for (const { conn, count } of chunk.connections) {
                const current = connectionCounts.get(conn) ?? 0;
                connectionCounts.set(conn, current + count);
            }
        }

        // Iterate Connections (Extract topic names and types)
        interface BagConnection {
            conn: number;
            topic: string;
            type?: string;
        }
        const connections: Iterable<BagConnection> =
            bag.connections instanceof Map
                ? bag.connections.values()
                : Object.values(bag.connections);

        for (const connection of connections) {
            const connId = connection.conn;
            const count = connectionCounts.get(connId) ?? 0;

            rawTopics.push({
                name: connection.topic,
                type: connection.type ?? 'unknown',
                nrMessages: BigInt(count),
            });
        }

        // Determine Date
        let fileDate: Date | undefined;
        if (bag.startTime) {
            fileDate = new Date(
                Math.round(bag.startTime.sec * 1000 + bag.startTime.nsec / 1e6),
            );
        }

        // Finalize (Deduplicate, Save, Create Event)
        await this.finishExtraction(
            targetEntity,
            rawTopics,
            bagReader.size(),
            fileDate,
            method,
            startTime,
            actor,
        );
    }
}
