import { FileType } from '@common/frontend_shared/enum';
import * as fs from 'node:fs/promises';
import logger from 'src/logger';

export class MagicNumberValidator {
    private static readonly MAGIC_NUMBERS: Partial<Record<FileType, Buffer>> = {
        [FileType.MCAP]: Buffer.from([
            0x89, 0x4d, 0x43, 0x41, 0x50, 0x30, 0x0d, 0x0a,
        ]), // \x89MCAP\x30\r\n
        [FileType.BAG]: Buffer.from('#ROSBAG V2.0\n'),
        [FileType.DB3]: Buffer.from('SQLite format 3\0'),
    };

    static async validate(
        filePath: string,
        fileType: FileType,
    ): Promise<boolean> {
        try {
            const handle = await fs.open(filePath, 'r');
            try {
                if (fileType === FileType.SVO2) {
                    // the magic number is unknown, so we just check if the file is not empty
                    const stat = await handle.stat();
                    return stat.size > 0;
                }

                if (fileType === FileType.YAML) {
                    // Basic check for YAML: readable text file
                    const buffer = Buffer.alloc(1024);
                    const { bytesRead } = await handle.read(buffer, 0, 1024, 0);
                    if (bytesRead === 0) return false;

                    // Check for common YAML markers or just that it's not binary garbage
                    // A simple heuristic: check if it has printable characters
                    // But YAML can start with anything.
                    // Let's check if it doesn't contain too many null bytes in the first 1KB
                    const nullCount = buffer
                        .subarray(0, bytesRead)
                        .filter((b) => b === 0).length;
                    return nullCount < bytesRead * 0.1; // Less than 10% null bytes
                }

                if (fileType === FileType.TUM) {
                    // TUM format: timestamp tx ty tz qx qy qz qw
                    // Check if the first non-comment line has 8 columns
                    const buffer = Buffer.alloc(4096);
                    const { bytesRead } = await handle.read(buffer, 0, 4096, 0);
                    if (bytesRead === 0) return false;

                    const content = buffer
                        .subarray(0, bytesRead)
                        .toString('utf8');
                    const lines = content.split('\n');

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.length === 0 || trimmed.startsWith('#'))
                            continue;

                        const parts = trimmed.split(/\s+/);
                        if (parts.length >= 8) return true;
                        return false;
                    }
                    return true;
                }

                const magic = this.MAGIC_NUMBERS[fileType];
                if (!magic) {
                    logger.warn(
                        `No magic number defined for file type ${fileType}, skipping validation.`,
                    );
                    return true;
                }

                const buffer = Buffer.alloc(magic.length);
                const { bytesRead } = await handle.read(
                    buffer,
                    0,
                    magic.length,
                    0,
                );

                if (bytesRead < magic.length) {
                    return false;
                }

                return buffer.equals(magic);
            } finally {
                await handle.close();
            }
        } catch (error) {
            logger.error(
                `Failed to validate magic number for ${filePath}: ${error}`,
            );
            return false;
        }
    }
}
