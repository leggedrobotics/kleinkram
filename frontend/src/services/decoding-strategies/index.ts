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
