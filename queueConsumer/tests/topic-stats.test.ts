import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { TOPIC_STATS_VERSION } from '@kleinkram/backend-common/services/topic-stats-backfill';
import { FileType } from '@kleinkram/shared';
import { McapWriter, TempBuffer } from '@mcap/core';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import { Repository } from 'typeorm';
import { McapMetadataService } from '../src/file-processor/handlers/mcap-metadata.service';
import { RosBagMetadataService } from '../src/file-processor/handlers/rosbag-metadata.service';
import { TopicStatsBackfillService } from '../src/file-processor/topic-stats-backfill.service';

// The queue consumer logger ships to Loki, keep it out of unit tests.
jest.mock('../src/logger', () => ({
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    __esModule: true,
    default: { warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// NestJS ships as ES modules, which this jest setup cannot load. The services
// under test only use it for dependency injection decorators, and are built
// by hand below.
jest.mock('@nestjs/common', () => ({
    Injectable: () => jest.fn(),
    Inject: () => jest.fn(),
}));
jest.mock('@nestjs/typeorm', () => ({
    InjectRepository: () => jest.fn(),
}));

const SECOND = 1_000_000_000n;
/** 2026-09-18T08:08:28Z, a whole second so ROS times stay exact. */
const ORIGIN_SECONDS = 1_789_718_908;
const ORIGIN = BigInt(ORIGIN_SECONDS) * SECOND;

const msDate = (timeNs: bigint): Date => new Date(Number(timeNs / 1_000_000n));

// --- A ROS 1 bag, written by hand -------------------------------------------
//
// `Bag.open()` only reads the bag header and the index after `index_pos`
// (connection and chunk info records), so that is all these bags hold.

const u32 = (value: number): Buffer => {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value);
    return buffer;
};

const u64 = (value: number): Buffer => {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(value));
    return buffer;
};

const rosTime = (sec: number): Buffer => Buffer.concat([u32(sec), u32(0)]);

const fields = (entries: [string, Buffer | string][]): Buffer =>
    Buffer.concat(
        entries.flatMap(([name, value]) => {
            const field = Buffer.concat([
                Buffer.from(`${name}=`),
                typeof value === 'string' ? Buffer.from(value) : value,
            ]);
            return [u32(field.length), field];
        }),
    );

const record = (header: Buffer, data: Buffer): Buffer =>
    Buffer.concat([u32(header.length), header, u32(data.length), data]);

interface BagChunk {
    /** Seconds since the origin. */
    start: number;
    end: number;
    /** Messages per connection id. */
    counts: Partial<Record<number, number>>;
}

function writeBag(topics: Record<number, string>, chunks: BagChunk[]): Buffer {
    const magic = Buffer.from('#ROSBAG V2.0\n');
    const headerFields = (indexPos: number): Buffer =>
        fields([
            ['op', Buffer.from([0x03])],
            ['index_pos', u64(indexPos)],
            ['conn_count', u32(Object.keys(topics).length)],
            ['chunk_count', u32(chunks.length)],
        ]);
    // Writers pad the bag header record to 4096 bytes.
    const headerLength = headerFields(0).length;
    const bagHeaderLength = 4 + headerLength + 4 + (4096 - headerLength);
    const indexPos = magic.length + bagHeaderLength;
    const bagHeader = record(
        headerFields(indexPos),
        Buffer.alloc(4096 - headerLength, 0x20),
    );

    const connections = Object.entries(topics).map(([conn, topic]) =>
        record(
            fields([
                ['op', Buffer.from([0x07])],
                ['conn', u32(Number(conn))],
                ['topic', topic],
            ]),
            fields([
                ['topic', topic],
                ['type', 'std_msgs/Empty'],
                ['md5sum', 'd41d8cd98f00b204e9800998ecf8427e'],
                ['message_definition', ''],
            ]),
        ),
    );

    const chunkInfos = chunks.map((chunk) => {
        const entries = Object.entries(chunk.counts).filter(
            (entry): entry is [string, number] => entry[1] !== undefined,
        );
        return record(
            fields([
                ['op', Buffer.from([0x06])],
                ['ver', u32(1)],
                ['chunk_pos', u64(indexPos)],
                ['start_time', rosTime(ORIGIN_SECONDS + chunk.start)],
                ['end_time', rosTime(ORIGIN_SECONDS + chunk.end)],
                ['count', u32(entries.length)],
            ]),
            Buffer.concat(
                entries.flatMap(([conn, count]) => [
                    u32(Number(conn)),
                    u32(count),
                ]),
            ),
        );
    });

    return Buffer.concat([magic, bagHeader, ...connections, ...chunkInfos]);
}

// --- An MCAP, written with @mcap/core ---------------------------------------

async function writeMcap(
    messages: { topic: string; second: number }[],
    options: { useMessageIndex?: boolean } = {},
): Promise<Buffer> {
    const buffer = new TempBuffer();
    const writer = new McapWriter({
        writable: buffer,
        // One message per chunk, so chunk bounds are message times.
        chunkSize: 1,
        useMessageIndex: options.useMessageIndex ?? true,
    });
    await writer.start({ profile: 'ros1', library: 'test' });
    const schemaId = await writer.registerSchema({
        name: 'std_msgs/Empty',
        encoding: 'ros1msg',
        data: new Uint8Array(),
    });
    const channelIds = new Map<string, number>();
    for (const { topic } of messages) {
        if (channelIds.has(topic)) continue;
        channelIds.set(
            topic,
            await writer.registerChannel({
                topic,
                schemaId,
                messageEncoding: 'ros1',
                metadata: new Map(),
            }),
        );
    }
    let sequence = 0;
    for (const { topic, second } of messages) {
        const time = ORIGIN + BigInt(second) * SECOND;
        await writer.addMessage({
            channelId: channelIds.get(topic) ?? 0,
            sequence: sequence++,
            logTime: time,
            publishTime: time,
            data: new Uint8Array(),
        });
    }
    await writer.end();
    return Buffer.from(buffer.get());
}

// --- A storage backend that answers range requests --------------------------

class RangeServer {
    private readonly objects = new Map<string, Buffer>();
    private server?: http.Server;

    put(name: string, content: Buffer): void {
        this.objects.set(name, content);
    }

    url(name: string): string {
        const { port } = this.server?.address() as AddressInfo;
        return `http://127.0.0.1:${String(port)}/${name}`;
    }

    async start(): Promise<void> {
        this.server = http.createServer((request, response) => {
            const content = this.objects.get(request.url?.slice(1) ?? '');
            if (!content) {
                response.writeHead(404).end();
                return;
            }
            const match = /bytes=(\d+)-(\d+)/.exec(request.headers.range ?? '');
            if (!match) {
                response.writeHead(200).end(content);
                return;
            }
            const start = Number(match[1]);
            const end = Math.min(Number(match[2]), content.length - 1);
            response
                .writeHead(206, {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Range': `bytes ${String(start)}-${String(end)}/${String(content.length)}`,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Content-Length': String(end - start + 1),
                })
                .end(content.subarray(start, end + 1));
        });
        await new Promise<void>((resolve) => {
            this.server?.listen(0, '127.0.0.1', resolve);
        });
    }

    async stop(): Promise<void> {
        await new Promise((resolve) => this.server?.close(resolve));
    }
}

const noRepository = {} as Repository<never>;
const mcapService = new McapMetadataService(
    noRepository,
    noRepository,
    noRepository,
);
const bagService = new RosBagMetadataService(
    noRepository,
    noRepository,
    noRepository,
);

const server = new RangeServer();
beforeAll(async () => server.start());
afterAll(async () => server.stop());

const IMU = 1;
const LIDAR = 2;
const TF_STATIC = 3;

/** One chunk per second for 100 s; /lidar from 30 s to 90 s. */
const typicalBag = (): Buffer =>
    writeBag(
        { [IMU]: '/imu', [LIDAR]: '/lidar', [TF_STATIC]: '/tf_static' },
        Array.from({ length: 100 }, (_, second) => ({
            start: second,
            end: second + 1,
            counts: {
                [IMU]: 400,
                ...(second >= 30 && second < 90 ? { [LIDAR]: 10 } : {}),
                ...(second === 0 ? { [TF_STATIC]: 3 } : {}),
            },
        })),
    );

describe('bag index topic stats', () => {
    test('should read first and last seen from the chunk info records', async () => {
        server.put('typical.bag', typicalBag());
        const stats = await bagService.probeTopicStatsFromUrl(
            server.url('typical.bag'),
        );

        expect(stats.get('/lidar')).toEqual({
            firstSeen: msDate(ORIGIN + 30n * SECOND),
            lastSeen: msDate(ORIGIN + 90n * SECOND),
            chunkCount: 60,
            coverage: [[30_000, 90_000]],
            // 600 messages over its own 60 s, not over the 100 s recording
            frequency: 10,
        });
        expect(stats.get('/imu')).toMatchObject({
            chunkCount: 100,
            coverage: [[0, 100_000]],
            frequency: 400,
        });
    });

    test('should store a latched topic with frequency 0', async () => {
        server.put('latched.bag', typicalBag());
        const stats = await bagService.probeTopicStatsFromUrl(
            server.url('latched.bag'),
        );

        expect(stats.get('/tf_static')).toEqual({
            firstSeen: msDate(ORIGIN),
            lastSeen: msDate(ORIGIN + SECOND),
            chunkCount: 1,
            coverage: [[0, 1000]],
            frequency: 0,
        });
    });

    test('should add up the connections of one topic', async () => {
        server.put(
            'two-publishers.bag',
            writeBag(
                { [IMU]: '/imu', [LIDAR]: '/imu' },
                Array.from({ length: 10 }, (_, second) => ({
                    start: second,
                    end: second + 1,
                    counts: second < 5 ? { [IMU]: 100 } : { [LIDAR]: 100 },
                })),
            ),
        );
        const stats = await bagService.probeTopicStatsFromUrl(
            server.url('two-publishers.bag'),
        );

        expect([...stats.keys()]).toEqual(['/imu']);
        expect(stats.get('/imu')).toMatchObject({
            chunkCount: 10,
            coverage: [[0, 10_000]],
            frequency: 100,
        });
    });
});

describe('MCAP summary topic stats', () => {
    test('should read first and last seen from the chunk indexes', async () => {
        // /imu from 0 s to 100 s, /lidar from 30 s to 90 s, /tf_static once.
        const messages = Array.from({ length: 101 }, (_, second) => [
            { topic: '/imu', second },
            ...(second >= 30 && second <= 90
                ? [{ topic: '/lidar', second }]
                : []),
            ...(second === 0 ? [{ topic: '/tf_static', second }] : []),
        ]).flat();
        server.put('typical.mcap', await writeMcap(messages));

        const stats = await mcapService.probeTopicStatsFromUrl(
            server.url('typical.mcap'),
        );

        expect(stats.get('/lidar')).toMatchObject({
            firstSeen: msDate(ORIGIN + 30n * SECOND),
            lastSeen: msDate(ORIGIN + 90n * SECOND),
            chunkCount: 61,
            frequency: 61 / 60,
        });
        expect(stats.get('/tf_static')).toMatchObject({
            chunkCount: 1,
            frequency: 0,
        });
    });

    test('should know nothing when the chunks have no message index', async () => {
        server.put(
            'unindexed.mcap',
            await writeMcap(
                Array.from({ length: 10 }, (_, second) => ({
                    topic: '/imu',
                    second,
                })),
                { useMessageIndex: false },
            ),
        );

        const stats = await mcapService.probeTopicStatsFromUrl(
            server.url('unindexed.mcap'),
        );

        expect(stats.size).toBe(0);
    });
});

// --- The backfill job, against an in-memory database ------------------------

interface FakeTopic {
    uuid: string;
    name: string;
    frequency: number;
    firstSeen?: Date | null;
    lastSeen?: Date | null;
    chunkCount?: number | null;
    coverage?: [number, number][] | null;
}

interface FakeFile {
    uuid: string;
    filename: string;
    type: FileType;
    topicStatsVersion: number;
}

function fakeDatabase(file: FakeFile, topics: FakeTopic[]) {
    const writes: { entity: string; values: Record<string, unknown> }[] = [];

    const apply = (
        entity: unknown,
        criteria: { uuid: string },
        values: Record<string, unknown>,
    ): void => {
        const { updatedAt, ...columns } = values;
        // The backfill must never bump `updatedAt`.
        expect(typeof updatedAt).toBe('function');
        if (entity === FileEntity) {
            writes.push({ entity: 'file', values: columns });
            // the `LessThan(TOPIC_STATS_VERSION)` guard
            if (file.topicStatsVersion < TOPIC_STATS_VERSION) {
                Object.assign(file, columns);
            }
        } else {
            writes.push({ entity: 'topic', values: columns });
            const topic = topics.find((each) => each.uuid === criteria.uuid);
            if (topic) Object.assign(topic, columns);
        }
    };

    const manager = {
        update: (
            entity: unknown,
            criteria: { uuid: string },
            values: Record<string, unknown>,
        ) => {
            apply(entity, criteria, values);
            return Promise.resolve();
        },
    };

    const fileRepo = {
        findOne: () =>
            Promise.resolve(
                file.topicStatsVersion < TOPIC_STATS_VERSION
                    ? { ...file }
                    : null,
            ),
        manager: {
            transaction: (run: (m: typeof manager) => Promise<void>) =>
                run(manager),
        },
    } as unknown as Repository<FileEntity>;

    const topicRepo = {
        find: () =>
            Promise.resolve(topics.map(({ uuid, name }) => ({ uuid, name }))),
    } as unknown as Repository<TopicEntity>;

    return { fileRepo, topicRepo, writes };
}

const storageServing = (
    name: string,
): { storage: IStorageBucket; presign: jest.Mock } => {
    const presign = jest.fn(() => Promise.resolve(server.url(name)));
    return {
        storage: {
            getInternalPresignedDownloadUrl: presign,
        } as unknown as IStorageBucket,
        presign,
    };
};

const bagFile = (): FakeFile => ({
    uuid: 'bag-uuid',
    filename: 'run.bag',
    type: FileType.BAG,
    topicStatsVersion: 0,
});

/** As ingestion before this change left them: count over the whole bag. */
const legacyTopics = (): FakeTopic[] => [
    { uuid: 't-imu', name: '/imu', frequency: 400 },
    { uuid: 't-lidar', name: '/lidar', frequency: 6 },
    { uuid: 't-tf', name: '/tf_static', frequency: 0.03 },
    { uuid: 't-gone', name: '/not-in-index', frequency: 1 },
];

describe('TopicStatsBackfillService', () => {
    test('should write the stats of every topic and the version', async () => {
        server.put('backfill.bag', typicalBag());
        const file = bagFile();
        const topics = legacyTopics();
        const { fileRepo, topicRepo } = fakeDatabase(file, topics);
        const service = new TopicStatsBackfillService(
            fileRepo,
            topicRepo,
            storageServing('backfill.bag').storage,
            mcapService,
            bagService,
        );

        expect(await service.backfillFile(file.uuid)).toBe('updated');

        expect(file.topicStatsVersion).toBe(TOPIC_STATS_VERSION);
        expect(topics.find((t) => t.name === '/lidar')).toMatchObject({
            frequency: 10,
            chunkCount: 60,
            coverage: [[30_000, 90_000]],
        });
        expect(topics.find((t) => t.name === '/tf_static')).toMatchObject({
            frequency: 0,
            chunkCount: 1,
        });
        // A topic the index does not know keeps its frequency and gets no
        // stats.
        expect(topics.find((t) => t.name === '/not-in-index')).toEqual({
            uuid: 't-gone',
            name: '/not-in-index',
            frequency: 1,
            firstSeen: null,
            lastSeen: null,
            chunkCount: null,
            coverage: null,
        });
    });

    test('should be safe to run twice on the same file', async () => {
        server.put('twice.bag', typicalBag());
        const file = bagFile();
        const topics = legacyTopics();
        const { fileRepo, topicRepo, writes } = fakeDatabase(file, topics);
        const { storage, presign } = storageServing('twice.bag');
        const service = new TopicStatsBackfillService(
            fileRepo,
            topicRepo,
            storage,
            mcapService,
            bagService,
        );

        // Two workers that both picked the file up before either finished.
        const [first, second] = await Promise.all([
            service.backfillFile(file.uuid),
            service.backfillFile(file.uuid),
        ]);
        expect([first, second]).toEqual(['updated', 'updated']);
        const afterBoth = structuredClone(topics);

        // A later run finds the file up to date and reads nothing.
        const writesBefore = writes.length;
        expect(await service.backfillFile(file.uuid)).toBe('skipped');
        expect(writes).toHaveLength(writesBefore);
        expect(presign).toHaveBeenCalledTimes(2);
        expect(topics).toEqual(afterBoth);
        expect(file.topicStatsVersion).toBe(TOPIC_STATS_VERSION);
    });

    test('should set the version and leave the stats alone when the index cannot be read', async () => {
        server.put('broken.bag', Buffer.from('not a bag at all'));
        const file = bagFile();
        const topics = legacyTopics();
        const { fileRepo, topicRepo, writes } = fakeDatabase(file, topics);
        const service = new TopicStatsBackfillService(
            fileRepo,
            topicRepo,
            storageServing('broken.bag').storage,
            mcapService,
            bagService,
        );

        expect(await service.backfillFile(file.uuid)).toBe('marked');

        expect(file.topicStatsVersion).toBe(TOPIC_STATS_VERSION);
        expect(writes.map((write) => write.entity)).toEqual(['file']);
        expect(topics).toEqual(legacyTopics());
    });

    test('should not read a db3, nor a bag whose topics live on its MCAP', async () => {
        for (const [type, topics] of [
            [FileType.DB3, legacyTopics()],
            [FileType.BAG, []],
        ] as const) {
            const file = { ...bagFile(), type };
            const { fileRepo, topicRepo, writes } = fakeDatabase(file, [
                ...topics,
            ]);
            const { storage, presign } = storageServing('typical.bag');
            const service = new TopicStatsBackfillService(
                fileRepo,
                topicRepo,
                storage,
                mcapService,
                bagService,
            );

            expect(await service.backfillFile(file.uuid)).toBe('marked');
            expect(presign).not.toHaveBeenCalled();
            expect(writes.map((write) => write.entity)).toEqual(['file']);
            expect(file.topicStatsVersion).toBe(TOPIC_STATS_VERSION);
        }
    });
});
