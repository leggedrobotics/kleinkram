import { UniversalHttpReader } from '@kleinkram/shared';
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
}
