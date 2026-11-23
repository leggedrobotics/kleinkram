import { UniversalHttpReader } from '@kleinkram/shared';
import type {
    RecordingInsights,
    RecordingMetadata,
} from './recording-insights';
import { LogMessage, ReadOptions, SampleCostModel } from './utilities';

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
     * Per topic, what a progressive read at a given stride downloads (see
     * `sampleCostOf`), or null when the format addresses messages
     * individually (then the cost is the messages' own size). Compressed
     * chunks are fetched whole, so a sampled message can cost far more than
     * its size. Topics missing from the record have no estimate either.
     */
    sampleCostModels(): Record<string, SampleCostModel | null> {
        return {};
    }

    /**
     * Whether `getMessages` honours `ReadOptions.window`. A strategy that
     * ignores it would read the whole topic for every playback window.
     */
    readonly supportsWindow: boolean = false;

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
