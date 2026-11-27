import {
    decodeNovatelPosition,
    decodeNovatelVersion,
    detectLineLevel,
    detectLineLevels,
    detectLogFormat,
    FileType,
    gpsToUnixMs,
    isNovatelLog,
    novatelCrc32,
    scanNovatelFrames,
} from '@kleinkram/shared';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { MagicNumberValidator } from '../src/file-processor/helper/magic-number.validator';

jest.mock('../src/logger', () => ({
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    __esModule: true,
    default: { warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const withCrc = (frame: Buffer): Buffer => {
    const crc = Buffer.alloc(4);
    crc.writeUInt32LE(novatelCrc32(frame));
    return Buffer.concat([frame, crc]);
};

/** A binary message with the 28 byte long header. */
const longFrame = (
    id: number,
    body: Buffer,
    { week = 2343, milliseconds = 216_743_000, timeStatus = 180 } = {},
): Buffer => {
    const header = Buffer.alloc(28);
    header.set([0xaa, 0x44, 0x12, 28]);
    header.writeUInt16LE(id, 4);
    header.writeUInt16LE(body.length, 8);
    header.writeUInt8(timeStatus, 13);
    header.writeUInt16LE(week, 14);
    header.writeUInt32LE(milliseconds, 16);
    return withCrc(Buffer.concat([header, body]));
};

/** A binary message with the 12 byte short header (e.g. RAWIMUSX). */
const shortFrame = (id: number, body: Buffer): Buffer => {
    const header = Buffer.alloc(12);
    header.set([0xaa, 0x44, 0x13, body.length]);
    header.writeUInt16LE(id, 4);
    header.writeUInt16LE(2343, 6);
    header.writeUInt32LE(216_743_010, 8);
    return withCrc(Buffer.concat([header, body]));
};

const asciiFrame = (content: string): Buffer => {
    const crc = novatelCrc32(Buffer.from(content))
        .toString(16)
        .padStart(8, '0');
    return Buffer.from(`#${content}*${crc}\r\n`);
};

const bestpos = (lat: number, lon: number, positionType = 50): Buffer => {
    const body = Buffer.alloc(72);
    body.writeUInt32LE(0, 0); // SOL_COMPUTED
    body.writeUInt32LE(positionType, 4);
    body.writeDoubleLE(lat, 8);
    body.writeDoubleLE(lon, 16);
    body.writeDoubleLE(435.2, 24);
    body.writeFloatLE(0.03, 40);
    body.writeFloatLE(0.04, 44);
    body.writeUInt8(21, 65);
    return body;
};

const version = (): Buffer => {
    const body = Buffer.alloc(4 + 108);
    body.writeUInt32LE(1, 0);
    body.writeUInt32LE(1, 4);
    body.write('MFDRYNTBEP1', 8);
    body.write('DMMU23100101J', 24);
    body.write('OEM7720-1.01', 40);
    body.write('OM7CR0902EN0001', 56);
    return body;
};

const sampleLog = (): Buffer =>
    Buffer.concat([
        longFrame(37, version()),
        Buffer.from('<RXCONFIG FILE 337 35.5 SATTIME 0 0.000 0a000000\r\n'),
        Buffer.from('<     ADJUST1PPS FILE 337 35.5 SATTIME 0 0.000\r\n'),
        shortFrame(1462, Buffer.alloc(40, 7)),
        longFrame(42, bestpos(46.9416, 7.139)),
        asciiFrame(
            'RXSTATUSEVENTA,FILE,0,35.5,FINESTEERING,2343,216743.100,02000000,0000,17439;STATUS,1,SET,"Position solution"',
        ),
        shortFrame(1462, Buffer.alloc(40, 9)),
    ]);

describe('NovAtel log reader', () => {
    it('should use the NovAtel CRC-32 (zlib polynomial, no inversion)', () => {
        // Bitwise reference implementation, checked against frames of a real
        // OEM7720 log; zlib's CRC-32 of the same input is 0xcbf43926.
        expect(novatelCrc32(Buffer.from('123456789'))).toBe(0x2d_fd_2d_88);
    });

    it('should split all four framings and skip continuation lines', () => {
        const { frames, checkedFrames, skippedBytes } =
            scanNovatelFrames(sampleLog());
        expect(frames.map((frame) => frame.name)).toEqual([
            'VERSION',
            'RXCONFIG',
            'RAWIMUSX',
            'BESTPOS',
            'RXSTATUSEVENT',
            'RAWIMUSX',
        ]);
        expect(checkedFrames).toBe(5);
        expect(skippedBytes).toBe(0);
    });

    it('should resynchronise on a window that starts mid-message', () => {
        const log = sampleLog();
        const { frames } = scanNovatelFrames(log.subarray(50));
        expect(frames.map((frame) => frame.name)).toContain('BESTPOS');
    });

    it('should reject a frame whose CRC does not match', () => {
        const frame = longFrame(42, bestpos(46.9, 7.1));
        frame[40] ^= 0xff;
        expect(scanNovatelFrames(frame).frames).toHaveLength(0);
    });

    it('should decode positions, receiver and GPS time', () => {
        const log = sampleLog();
        const { frames } = scanNovatelFrames(log);
        const position = frames
            .map((frame) => decodeNovatelPosition(log, frame))
            .find(Boolean);
        expect(position).toMatchObject({
            source: 'BESTPOS',
            positionType: 'NARROW_INT',
            lat: 46.9416,
            lon: 7.139,
            satellites: 21,
        });
        expect(position?.horizontalSigma).toBeCloseTo(0.05, 5);
        expect(new Date(position?.time ?? 0).toISOString()).toBe(
            new Date(gpsToUnixMs(2343, 216_743_000)).toISOString(),
        );
        // GPS week 2343, 60:12:23 into the week, minus 18 leap seconds
        expect(new Date(gpsToUnixMs(2343, 216_743_000)).toISOString()).toBe(
            '2024-12-03T12:12:05.000Z',
        );

        const receiver = frames
            .map((frame) => decodeNovatelVersion(log, frame))
            .find(Boolean);
        expect(receiver).toEqual({
            model: 'MFDRYNTBEP1',
            serial: 'DMMU23100101J',
            hardware: 'OEM7720-1.01',
            firmware: 'OM7CR0902EN0001',
        });
    });

    it('should drop positions without a fix', () => {
        const frame = longFrame(42, bestpos(0, 0, 0));
        const [parsed] = scanNovatelFrames(frame).frames;
        expect(parsed).toBeDefined();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(decodeNovatelPosition(frame, parsed!)).toBeUndefined();
    });
});

describe('Log format detection', () => {
    it('should recognise a NovAtel log', () => {
        expect(isNovatelLog(sampleLog())).toBe(true);
        expect(detectLogFormat(sampleLog(), true)).toBe('novatel');
    });

    it('should treat a text log with # comments as text', () => {
        const text = Buffer.from(
            '# started\n2024-12-03 12:00:00 [INFO] ready *done\n#x*00000000\n',
        );
        expect(isNovatelLog(text)).toBe(false);
        expect(detectLogFormat(text, true)).toBe('text');
    });

    it('should accept ANSI colour codes in a text log', () => {
        const text = Buffer.from(
            '\u001B[31mERROR\u001B[0m failed\n\u001B[32mINFO\u001B[0m ok\n',
        );
        expect(detectLogFormat(text, true)).toBe('text');
    });

    it('should leave other binary data unknown', () => {
        const binary = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0xff, 0x01]);
        expect(detectLogFormat(binary, true)).toBe('unknown');
    });
});

describe('LOG ingestion validation', () => {
    let directory: string;

    beforeAll(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'log-validate-'));
    });

    afterAll(async () => {
        await fs.rm(directory, { recursive: true, force: true });
    });

    const fileWith = async (
        name: string,
        content: string | Buffer,
    ): Promise<string> => {
        const filePath = path.join(directory, name);
        await fs.writeFile(filePath, content);
        return filePath;
    };

    it('should accept NovAtel, text and unknown binary logs', async () => {
        const files = await Promise.all([
            fileWith('receiver.log', sampleLog()),
            fileWith('robot.log', '[INFO] up\n[WARN] hot\n'),
            fileWith('other.log', Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xff])),
        ]);
        for (const file of files) {
            await expect(
                MagicNumberValidator.validate(file, FileType.LOG),
            ).resolves.toEqual({ valid: true });
        }
    });

    it('should report an empty log', async () => {
        const file = await fileWith('empty.log', '');
        await expect(
            MagicNumberValidator.validate(file, FileType.LOG),
        ).resolves.toEqual({ valid: false, error: 'File is empty' });
    });
});

describe('Text log levels', () => {
    it.each([
        ['2024-12-03 12:00:00,123 - planner - ERROR - no path', 'ERROR'],
        ['[WARN] [1733228803.1]: battery low', 'WARN'],
        ['[info] started', 'INFO'],
        ['E1203 12:32:55.104 1234 driver.cpp:42] timeout', 'ERROR'],
        ['12:00:00 | CRITICAL | out of memory', 'FATAL'],
        ['DEBUG: tick', 'DEBUG'],
    ])('should read the level of "%s"', (line, expected) => {
        expect(detectLineLevel(line)).toBe(expected);
    });

    it('should not read a level from a word inside the message', () => {
        expect(detectLineLevel('request finished, Errors: 0')).toBeUndefined();
        expect(detectLineLevel('INFORMATION follows')).toBeUndefined();
    });

    it('should give continuation lines the level of their entry', () => {
        expect(
            detectLineLevels([
                '2024-12-03 12:00:00 ERROR crash',
                'Traceback (most recent call last):',
                '    at main (app.ts:1)',
                '2024-12-03 12:00:01 no level here',
                '  indented below an entry without level',
            ]),
        ).toEqual(['ERROR', 'ERROR', 'ERROR', undefined, undefined]);
    });
});
