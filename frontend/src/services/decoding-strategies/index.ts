import { UniversalHttpReader } from '@kleinkram/shared';
import { LogMessage } from './utilities';

export abstract class DecodingStrategy {
    abstract init(reader: UniversalHttpReader): Promise<void>;
    abstract getMessages(
        topic: string,
        limit?: number,
        onMessage?: (message: LogMessage) => void,
        signal?: AbortSignal,
        startTime?: bigint,
        /**
         * Keep only every n-th message of the topic (1 = keep all). Used to
         * bound memory and decoding work for very high-rate topics.
         */
        stride?: number,
    ): Promise<LogMessage[]>;

    getSchema(): string | null {
        return null;
    }
}
