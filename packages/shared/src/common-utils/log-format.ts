import { isNovatelLog } from './novatel-log';
import { isPlainTextSample } from './text-decoding';

/**
 * What a `.log` file holds. The extension is used by many tools for unrelated
 * formats, so the content decides:
 *
 * - `novatel`: a NovAtel OEM7 receiver log (binary or ASCII frames with CRC)
 * - `text`: a line-oriented text log
 * - `unknown`: anything else, e.g. another vendor's binary log. Kept as is,
 *   only without a preview.
 */
export type LogFormat = 'novatel' | 'text' | 'unknown';

/** Leading bytes inspected to tell the formats apart. */
export const LOG_SAMPLE_BYTES = 64 * 1024;

export const detectLogFormat = (
    sample: Uint8Array,
    sampleIsCompleteFile: boolean,
): LogFormat => {
    // NovAtel first: its ASCII framing is text, but the CRCs make it certain.
    if (isNovatelLog(sample)) return 'novatel';
    if (isPlainTextSample(sample, sampleIsCompleteFile)) return 'text';
    return 'unknown';
};
