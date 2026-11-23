import {
    computeRecordingCoverage,
    liveFileTopicStats,
    rebaseSpans,
    RecordingChannel,
    RecordingChunk,
    storedFileTopicStats,
} from '@kleinkram/shared';

const SECOND = 1_000_000_000n;
const ORIGIN = 1_789_718_908_000_000_000n;
const START = new Date(Number(ORIGIN / 1_000_000n));

const IMU = 1;
const LIDAR = 2;
const TF_STATIC = 3;

const chunk = (
    start: number,
    end: number,
    channelIds: number[],
): RecordingChunk => ({
    startTime: ORIGIN + BigInt(start) * SECOND,
    endTime: ORIGIN + BigInt(end) * SECOND,
    compression: '',
    compressedSize: 1000n,
    uncompressedSize: 1000n,
    channelIds,
    hasMessageIndex: true,
});

const recording = (
    seconds: number,
    channelsAt: (second: number) => number[],
): RecordingChunk[] =>
    Array.from({ length: seconds }, (_, second) =>
        chunk(second, second + 1, channelsAt(second)),
    );

const channels: RecordingChannel[] = [
    { id: IMU, topic: '/imu', messageCount: 10_000 },
    { id: LIDAR, topic: '/lidar', messageCount: 200 },
    { id: TF_STATIC, topic: '/tf_static', messageCount: 3 },
];

const live = (chunks: RecordingChunk[]) =>
    liveFileTopicStats(
        computeRecordingCoverage(chunks, channels),
        chunks,
        channels,
    );

/** `seconds` from the recording start, as the API returns timestamps. */
const at = (seconds: number): string =>
    new Date(START.getTime() + seconds * 1000).toISOString();

describe('liveFileTopicStats', () => {
    test('should rate a late topic over its own span', () => {
        // /lidar only runs for the last 20 of 100 seconds.
        const stats = live(
            recording(100, (second) => (second < 80 ? [IMU] : [IMU, LIDAR])),
        );

        expect(stats?.source).toBe('live');
        expect(stats?.topics['/lidar']).toMatchObject({
            firstSeen: 80,
            lastSeen: 100,
            chunkCount: 20,
            meanHz: 10,
        });
        expect(stats?.topics['/imu']?.meanHz).toBe(100);
    });

    test('should give a one-shot topic a span but no rate', () => {
        const stats = live(
            recording(100, (second) =>
                second === 0 ? [IMU, TF_STATIC] : [IMU],
            ),
        );

        expect(stats?.topics['/tf_static']).toMatchObject({
            firstSeen: 0,
            lastSeen: 1,
            chunkCount: 1,
            meanHz: undefined,
            gaps: [],
        });
    });

    test('should be undefined without coverage', () => {
        expect(liveFileTopicStats(undefined, [], channels)).toBeUndefined();
    });
});

describe('storedFileTopicStats', () => {
    const file = {
        recordingStartDate: START,
        durationSeconds: 100,
        topicStatsVersion: 1,
    };

    test('should wait until the file has been indexed for topic stats', () => {
        expect(
            storedFileTopicStats({ ...file, topicStatsVersion: 0 }, []),
        ).toBeUndefined();
        expect(
            storedFileTopicStats({ ...file, recordingStartDate: null }, []),
        ).toBeUndefined();
    });

    test('should place stored spans on the recording time axis', () => {
        const stats = storedFileTopicStats(file, [
            {
                name: '/lidar',
                frequency: 10,
                firstSeen: at(80),
                lastSeen: at(100),
                chunkCount: 20,
                coverage: [[80_000, 100_000]],
            },
        ]);

        expect(stats?.source).toBe('stored');
        expect(stats?.startTime).toBe(ORIGIN);
        expect(stats?.durationSeconds).toBe(100);
        expect(stats?.topics['/lidar']).toEqual({
            firstSeen: 80,
            lastSeen: 100,
            chunkCount: 20,
            meanHz: 10,
            covered: [{ start: 80, end: 100 }],
            gaps: [{ start: 0, end: 80 }],
        });
    });

    test('should report a dropout in the middle and nothing for one-shot topics', () => {
        const stats = storedFileTopicStats(file, [
            {
                name: '/imu',
                frequency: 100,
                firstSeen: at(0),
                lastSeen: at(100),
                chunkCount: 79,
                coverage: [
                    [0, 40_000],
                    [61_000, 100_000],
                ],
            },
            {
                name: '/tf_static',
                frequency: null,
                firstSeen: at(0),
                lastSeen: at(1),
                chunkCount: 1,
                coverage: [[0, 1000]],
            },
        ]);

        expect(stats?.topics['/imu']?.gaps).toEqual([{ start: 40, end: 61 }]);
        expect(stats?.topics['/tf_static']).toMatchObject({
            meanHz: undefined,
            gaps: [],
        });
    });

    test('should show the stored rate as is, also for a file with few chunks', () => {
        // In a file of fewer than 5 chunks the backend cannot tell a one-shot
        // topic from a stream, so it stores a rate for a topic in 2 chunks.
        const stats = storedFileTopicStats({ ...file, durationSeconds: 2 }, [
            {
                name: '/imu',
                frequency: 100,
                firstSeen: at(0),
                lastSeen: at(2),
                chunkCount: 2,
                coverage: [[0, 2000]],
            },
            {
                name: '/tf_static',
                frequency: null,
                firstSeen: at(0),
                lastSeen: at(1),
                chunkCount: 1,
                coverage: [[0, 1000]],
            },
        ]);

        expect(stats?.topics['/imu']?.meanHz).toBe(100);
        expect(stats?.topics['/tf_static']?.meanHz).toBeUndefined();
    });

    test('should leave out topics whose stats could not be read', () => {
        const stats = storedFileTopicStats(file, [
            {
                name: '/unindexed',
                frequency: 0,
                firstSeen: null,
                lastSeen: null,
                chunkCount: null,
                coverage: null,
            },
        ]);

        expect(stats?.topics).toEqual({});
    });
});

describe('rebaseSpans', () => {
    test('should move spans onto another origin', () => {
        expect(
            rebaseSpans([{ start: 10, end: 12 }], ORIGIN + SECOND, ORIGIN),
        ).toEqual([{ start: 11, end: 13 }]);
    });
});
