import { FileType } from '@kleinkram/shared';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { MagicNumberValidator } from '../src/file-processor/helper/magic-number.validator';
import {
    MAX_STATE_COMMENT_LENGTH,
    sanitizeStateComment,
    toStateComment,
} from '../src/file-processor/helper/state-comment';

// The queue consumer logger ships to Loki, keep it out of unit tests.
jest.mock('../src/logger', () => ({
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    __esModule: true,
    default: { warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const MCAP_MAGIC = Buffer.from([
    0x89, 0x4d, 0x43, 0x41, 0x50, 0x30, 0x0d, 0x0a,
]);

describe('stateComment sanitization', () => {
    it('keeps a plain message unchanged', () => {
        expect(sanitizeStateComment('Invalid record length')).toBe(
            'Invalid record length',
        );
    });

    it('drops everything after the first line (stack traces)', () => {
        const error = new Error('Unexpected end of chunk');
        error.message += '\n    at McapReader.read (/app/dist/main.js:1:1)';
        expect(toStateComment('Failed to read the MCAP file', error)).toBe(
            'Failed to read the MCAP file: Unexpected end of chunk',
        );
    });

    it('removes presigned URLs including their signature', () => {
        const comment = sanitizeStateComment(
            'GET http://seaweedfs:8333/files/abc?X-Amz-Signature=deadbeef failed with 403',
        );
        expect(comment).toBe('GET <url> failed with 403');
        expect(comment).not.toContain('X-Amz-Signature');
        expect(comment).not.toContain('seaweedfs');
    });

    it('strips directories of absolute paths but keeps the file name', () => {
        expect(
            sanitizeStateComment(
                "ENOENT: no such file or directory, open '/tmp/ingest-1234/work/recording.bag'",
            ),
        ).toBe("ENOENT: no such file or directory, open 'recording.bag'");
    });

    it('leaves relative paths and ratios alone', () => {
        expect(sanitizeStateComment('topic /imu/data at 3/4 of file')).toBe(
            'topic /imu/data at 3/4 of file',
        );
    });

    it('truncates long messages', () => {
        const comment = toStateComment('Failed', new Error('x'.repeat(2000)));
        expect(comment).toHaveLength(MAX_STATE_COMMENT_LENGTH);
        expect(comment.endsWith('…')).toBe(true);
    });

    it('falls back to the summary for non-error values', () => {
        expect(toStateComment('Failed to read the DB3 file', undefined)).toBe(
            'Failed to read the DB3 file',
        );
        expect(toStateComment('Failed', { code: 42 })).toBe('Failed');
    });
});

describe('MagicNumberValidator diagnostics', () => {
    let directory: string;

    beforeAll(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'kk-validate-'));
    });

    afterAll(async () => {
        await fs.rm(directory, { recursive: true, force: true });
    });

    const fileWith = async (
        name: string,
        content: Buffer | string,
    ): Promise<string> => {
        const filePath = path.join(directory, name);
        await fs.writeFile(filePath, content);
        return filePath;
    };

    it('accepts a valid MCAP header', async () => {
        const filePath = await fileWith(
            'valid.mcap',
            Buffer.concat([MCAP_MAGIC, Buffer.alloc(32)]),
        );
        await expect(
            MagicNumberValidator.validate(filePath, FileType.MCAP),
        ).resolves.toEqual({ valid: true });
    });

    it('explains a wrong MCAP magic number', async () => {
        const filePath = await fileWith(
            'split.mcap',
            Buffer.from('0123456789abcdef'),
        );
        const result = await MagicNumberValidator.validate(
            filePath,
            FileType.MCAP,
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid magic number');
        expect(result.error).toContain(MCAP_MAGIC.toString('hex'));
        expect(result.error).toContain('https://mcap.dev/spec');
    });

    it('explains a truncated header', async () => {
        const filePath = await fileWith('tiny.bag', '#ROS');
        const result = await MagicNumberValidator.validate(
            filePath,
            FileType.BAG,
        );
        expect(result).toEqual({
            valid: false,
            error: `File too small: only 4 bytes, need at least 13 for ${FileType.BAG} header`,
        });
    });

    it('explains a TUM file with too few columns', async () => {
        const filePath = await fileWith('poses.tum', '# header\n1 2 3\n');
        await expect(
            MagicNumberValidator.validate(filePath, FileType.TUM),
        ).resolves.toEqual({
            valid: false,
            error: 'TUM validation failed: expected 8 columns, found 3',
        });
    });

    it('reports empty text files', async () => {
        const filePath = await fileWith('empty.md', '');
        await expect(
            MagicNumberValidator.validate(filePath, FileType.MD),
        ).resolves.toEqual({ valid: false, error: 'File is empty' });
    });

    it('reports binary content in a text format', async () => {
        const filePath = await fileWith(
            'binary.csv',
            Buffer.from([0x00, 0x01, 0x02, 0xff, 0x00]),
        );
        const result = await MagicNumberValidator.validate(
            filePath,
            FileType.CSV,
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain('not plain text');
    });

    it('accepts valid markdown and CSV', async () => {
        const md = await fileWith('notes.md', '# Notes\n\nSome text.\n');
        const csv = await fileWith('data.csv', 'a,b,c\n1,2,3\n4,5,6\n');
        await expect(
            MagicNumberValidator.validate(md, FileType.MD),
        ).resolves.toEqual({ valid: true });
        await expect(
            MagicNumberValidator.validate(csv, FileType.CSV),
        ).resolves.toEqual({ valid: true });
    });

    it('does not leak paths when the file cannot be read', async () => {
        const missing = path.join(directory, 'does-not-exist.mcap');
        const result = await MagicNumberValidator.validate(
            missing,
            FileType.MCAP,
        );
        expect(result.valid).toBe(false);
        expect(result.error).not.toContain(directory);
    });
});
