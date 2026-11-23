import {
    computeRecordingCoverage,
    computeTopicStats,
    findPauses,
    mergeSpans,
    RecordingChannel,
    RecordingChunk,
    summarizeStorage,
    topicFrequency,
} from '@kleinkram/shared';

const SECOND = 1_000_000_000n;
const ORIGIN = 1_789_718_908_000_000_000n;

const IMU = 1;
const LIDAR = 2;
const TF_STATIC = 3;
const HEARTBEAT = 4;

/** A chunk covering `[start, end]` seconds of the recording. */
const chunk = (
    start: number,
    end: number,
    channelIds: number[],
    overrides: Partial<RecordingChunk> = {},
): RecordingChunk => ({
    startTime: ORIGIN + BigInt(start) * SECOND,
    endTime: ORIGIN + BigInt(end) * SECOND,
    compression: '',
    compressedSize: 1000n,
    uncompressedSize: 1000n,
    channelIds,
    hasMessageIndex: true,
    ...overrides,
});

/** One chunk per second, each holding whatever `channelsAt` returns. */
const recording = (
    seconds: number,
    channelsAt: (second: number) => number[],
): RecordingChunk[] =>
    Array.from({ length: seconds }, (_, second) =>
        chunk(second, second + 1, channelsAt(second)),
    );

const channels: RecordingChannel[] = [
    { id: IMU, topic: '/imu', messageCount: 40_000 },
    { id: LIDAR, topic: '/lidar', messageCount: 800 },
    { id: TF_STATIC, topic: '/tf_static', messageCount: 1 },
    { id: HEARTBEAT, topic: '/heartbeat', messageCount: 10 },
];

describe('computeRecordingCoverage', () => {
    test('a topic present in every chunk is covered end to end', () => {
        const coverage = computeRecordingCoverage(
            recording(100, () => [IMU]),
            channels,
        );

        expect(coverage?.startTime).toBe(ORIGIN);
        expect(coverage?.durationSeconds).toBe(100);
        expect(coverage?.topics['/imu']).toEqual({
            covered: [{ start: 0, end: 100 }],
            gaps: [],
            chunkCount: 100,
            firstSeen: ORIGIN,
            lastSeen: ORIGIN + 100n * SECOND,
        });
    });

    test('a topic that drops out for a while gets a gap there, and only there', () => {
        const coverage = computeRecordingCoverage(
            recording(100, (second) =>
                second >= 40 && second < 61 ? [IMU] : [IMU, LIDAR],
            ),
            channels,
        );

        expect(coverage?.topics['/lidar']).toEqual({
            covered: [
                { start: 0, end: 40 },
                { start: 61, end: 100 },
            ],
            gaps: [{ start: 40, end: 61 }],
            chunkCount: 79,
            firstSeen: ORIGIN,
            lastSeen: ORIGIN + 100n * SECOND,
        });
        expect(coverage?.topics['/imu']?.gaps).toEqual([]);
    });

    test('a topic that only starts late has a gap at the front', () => {
        const coverage = computeRecordingCoverage(
            recording(100, (second) => (second < 30 ? [IMU] : [IMU, LIDAR])),
            channels,
        );

        expect(coverage?.topics['/lidar']?.gaps).toEqual([
            { start: 0, end: 30 },
        ]);
    });

    test('a slow topic is not reported for the chunks it skips', () => {
        // Ten messages in 100 s: present in every tenth chunk only.
        const coverage = computeRecordingCoverage(
            recording(100, (second) =>
                second % 10 === 0 ? [IMU, HEARTBEAT] : [IMU],
            ),
            channels,
        );

        expect(coverage?.topics['/heartbeat']?.gaps).toEqual([]);
        expect(coverage?.topics['/heartbeat']?.covered).toHaveLength(1);
    });

    test('a latched topic is one short span and never a gap', () => {
        const coverage = computeRecordingCoverage(
            recording(100, (second) =>
                second === 0 ? [IMU, TF_STATIC] : [IMU],
            ),
            channels,
        );

        expect(coverage?.topics['/tf_static']).toEqual({
            covered: [{ start: 0, end: 1 }],
            gaps: [],
            chunkCount: 1,
            firstSeen: ORIGIN,
            lastSeen: ORIGIN + SECOND,
        });
    });

    test('a topic published a few times at the start is not a dropout', () => {
        // What /tf_static looks like in practice: seven messages in the
        // first two chunks, then nothing for the rest of the recording.
        const coverage = computeRecordingCoverage(
            recording(100, (second) => (second < 2 ? [IMU, LIDAR] : [IMU])),
            [
                { id: IMU, topic: '/imu', messageCount: 40_000 },
                { id: LIDAR, topic: '/tf_static', messageCount: 7 },
            ],
        );

        expect(coverage?.topics['/tf_static']).toEqual({
            covered: [{ start: 0, end: 2 }],
            gaps: [],
            chunkCount: 2,
            firstSeen: ORIGIN,
            lastSeen: ORIGIN + 2n * SECOND,
        });
    });

    test('several channels of one topic are drawn as one topic', () => {
        const coverage = computeRecordingCoverage(
            recording(20, (second) => (second < 10 ? [IMU] : [LIDAR])),
            [
                { id: IMU, topic: '/imu', messageCount: 100 },
                { id: LIDAR, topic: '/imu', messageCount: 100 },
            ],
        );

        expect(Object.keys(coverage?.topics ?? {})).toEqual(['/imu']);
        expect(coverage?.topics['/imu']?.covered).toEqual([
            { start: 0, end: 20 },
        ]);
    });

    test('chunks need not arrive in time order', () => {
        const ordered = recording(50, () => [IMU]);
        const coverage = computeRecordingCoverage(
            // eslint-disable-next-line unicorn/no-array-reverse
            [...ordered].reverse(),
            channels,
        );

        expect(coverage?.topics['/imu']?.covered).toEqual([
            { start: 0, end: 50 },
        ]);
    });

    test('a chunk that spans a recording pause is reported as a pause', () => {
        const chunks = [
            ...recording(40, () => [IMU]),
            // The recorder stopped for 9 s; the open chunk just covers it.
            chunk(40, 50, [IMU]),
            ...recording(50, () => [IMU]).map((later) => ({
                ...later,
                startTime: later.startTime + 50n * SECOND,
                endTime: later.endTime + 50n * SECOND,
            })),
        ];

        const coverage = computeRecordingCoverage(chunks, channels);

        expect(coverage?.pauses).toEqual([{ start: 40, end: 50 }]);
        // The chunk exists, so the topic still counts as covered there.
        expect(coverage?.topics['/imu']?.gaps).toEqual([]);
    });

    test('there is nothing to draw without chunks or without duration', () => {
        expect(computeRecordingCoverage([], channels)).toBeUndefined();
        expect(
            computeRecordingCoverage([chunk(5, 5, [IMU])], channels),
        ).toBeUndefined();
    });

    test('works without statistics, where message counts are unknown', () => {
        const coverage = computeRecordingCoverage(
            recording(100, (second) =>
                second >= 40 && second < 61 ? [IMU] : [IMU, LIDAR],
            ),
            channels.map((channel) => ({
                ...channel,
                messageCount: undefined,
            })),
        );

        expect(coverage?.topics['/lidar']?.gaps).toEqual([
            { start: 40, end: 61 },
        ]);
    });
    test('no topic coverage when some chunks have no message index', () => {
        // The middle stretch was written without indexes: its chunks list no
        // channels, which must not read as every topic dropping out there.
        const chunks = recording(100, (second) =>
            second >= 40 && second < 60 ? [] : [IMU, LIDAR],
        ).map((each, second) =>
            second >= 40 && second < 60
                ? { ...each, hasMessageIndex: false }
                : each,
        );

        const coverage = computeRecordingCoverage(chunks, channels);

        expect(coverage?.durationSeconds).toBe(100);
        expect(coverage?.topics).toEqual({});
    });
});

/** A topic seen in `chunkCount` chunks over its first `seconds` seconds. */
const span = (
    chunkCount: number,
    seconds: number,
): { chunkCount: number; firstSeen: bigint; lastSeen: bigint } => ({
    chunkCount,
    firstSeen: ORIGIN,
    lastSeen: ORIGIN + BigInt(seconds) * SECOND,
});

describe('topicFrequency', () => {
    test('divides by the span the topic publishes in', () => {
        // 600 messages over 60 s of a 600 s recording is 10 Hz, not 1 Hz.
        expect(topicFrequency(600, span(60, 60))).toBe(10);
    });

    test('a one-shot topic has no rate', () => {
        expect(topicFrequency(7, span(4, 2))).toBeUndefined();
        expect(topicFrequency(1, span(1, 1))).toBeUndefined();
    });

    test('a topic without a span has no rate', () => {
        expect(topicFrequency(50, span(5, 0))).toBeUndefined();
    });

    test('a topic in exactly five chunks is a stream', () => {
        expect(topicFrequency(50, span(5, 5))).toBe(10);
    });

    test('is unknown without a message count', () => {
        expect(topicFrequency(undefined, span(60, 60))).toBeUndefined();
    });
});

describe('computeTopicStats', () => {
    test('stores where each topic has data, in milliseconds', () => {
        // /lidar starts 30 s late and stops 10 s early in a 100 s recording.
        const stats = computeTopicStats(
            recording(100, (second) =>
                second >= 30 && second < 90 ? [IMU, LIDAR] : [IMU],
            ),
            [
                { id: IMU, topic: '/imu', messageCount: 40_000 },
                { id: LIDAR, topic: '/lidar', messageCount: 600 },
            ],
        );

        expect(stats.get('/lidar')).toEqual({
            firstSeen: new Date(Number((ORIGIN + 30n * SECOND) / 1_000_000n)),
            lastSeen: new Date(Number((ORIGIN + 90n * SECOND) / 1_000_000n)),
            chunkCount: 60,
            coverage: [[30_000, 90_000]],
            frequency: 10,
        });
        expect(stats.get('/imu')?.frequency).toBe(400);
    });

    test('a latched topic is stored without a rate', () => {
        const stats = computeTopicStats(
            recording(100, (second) =>
                second === 0 ? [IMU, TF_STATIC] : [IMU],
            ),
            channels,
        );

        expect(stats.get('/tf_static')).toMatchObject({
            chunkCount: 1,
            coverage: [[0, 1000]],
        });
        expect(stats.get('/tf_static')?.frequency).toBeUndefined();
    });

    test('rounds sub-millisecond chunk bounds', () => {
        const stats = computeTopicStats(
            [
                chunk(0, 1, [IMU]),
                {
                    ...chunk(1, 2, [IMU]),
                    endTime: ORIGIN + 2n * SECOND + 400_000n,
                },
            ],
            channels,
        );

        expect(stats.get('/imu')?.coverage).toEqual([[0, 2000]]);
    });

    test('knows nothing when some chunks have no message index', () => {
        const chunks = recording(10, () => [IMU]).map((each, second) =>
            second === 5 ? { ...each, hasMessageIndex: false } : each,
        );

        expect(computeTopicStats(chunks, channels).size).toBe(0);
    });

    test('knows nothing without chunks', () => {
        expect(computeTopicStats([], channels).size).toBe(0);
    });
});

describe('findPauses', () => {
    test('needs enough chunks to know what a usual chunk looks like', () => {
        expect(
            findPauses([
                { start: 0, end: 1 },
                { start: 1, end: 60 },
            ]),
        ).toEqual([]);
    });

    test('ignores chunks that are long but not notably long', () => {
        const spans = Array.from({ length: 20 }, (_, index) => ({
            start: index * 0.1,
            // One chunk is ten times the others and still only a second.
            end: index === 7 ? index * 0.1 + 1 : (index + 1) * 0.1,
        }));

        expect(findPauses(spans)).toEqual([]);
    });
});

describe('mergeSpans', () => {
    test('joins spans closer than the tolerance and keeps the rest apart', () => {
        expect(
            mergeSpans(
                [
                    { start: 0, end: 1 },
                    { start: 1.5, end: 3 },
                    { start: 2, end: 2.5 },
                    { start: 9, end: 10 },
                ],
                1,
            ),
        ).toEqual([
            { start: 0, end: 3 },
            { start: 9, end: 10 },
        ]);
    });
});

describe('summarizeStorage', () => {
    test('uncompressed, indexed chunks allow per-message access', () => {
        expect(summarizeStorage(recording(3, () => [IMU]))).toEqual({
            chunkCount: 3,
            compressions: ['none'],
            compressedSize: 3000,
            uncompressedSize: 3000,
            perMessageAccess: true,
        });
    });

    test('one compressed chunk is enough to lose it', () => {
        const storage = summarizeStorage([
            chunk(0, 1, [IMU]),
            chunk(1, 2, [IMU], { compression: 'zstd', compressedSize: 400n }),
        ]);

        expect(storage.compressions).toEqual(['none', 'zstd']);
        expect(storage.compressedSize).toBe(1400);
        expect(storage.perMessageAccess).toBe(false);
    });

    test('so is one chunk without a message index', () => {
        expect(
            summarizeStorage([chunk(0, 1, [], { hasMessageIndex: false })])
                .perMessageAccess,
        ).toBe(false);
    });

    test('a file without chunks has nothing to address', () => {
        expect(summarizeStorage([]).perMessageAccess).toBe(false);
    });
});
