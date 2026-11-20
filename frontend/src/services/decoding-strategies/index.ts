import { UniversalHttpReader } from '@kleinkram/shared';
import type {
    RecordingInsights,
    RecordingMetadata,
} from './recording-insights';
import { LogMessage, ReadOptions } from './utilities';

export abstract class DecodingStrategy {
    abstract init(reader: UniversalHttpReader): Promise<void>;
    abstract getMessages(
        topic: string,
        limit?: number,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        startTime?: bigint,
        options?: ReadOptions,
    ): Promise<LogMessage[]>;

    /**
     * Bytes a progressive read of `topic` at this stride downloads, or
     * undefined when the format addresses messages individually (then the
     * cost is the messages' own size). Compressed chunks are fetched whole,
     * so a sampled message can cost far more than its size.
     */
    sampleCost(_topic: string, _stride: number): number | undefined {
        return undefined;
    }

    getSchema(): string | null {
        return null;
    }

    /** What the file's index says about the recording, if the format has one. */
    getInsights(): RecordingInsights | null {
        return null;
    }

    /** The body of the attachment at `index` of `getInsights().attachments`. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    readAttachment(index: number): Promise<Uint8Array | undefined> {
        return Promise.resolve(undefined);
    }

    readMetadata(): Promise<RecordingMetadata[]> {
        return Promise.resolve([]);
    }
}
