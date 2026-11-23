/**
 * Messages between the file preview and its worker.
 *
 * Hand-written rather than Comlink: the two calls that matter need what a
 * generic proxy does not give. A read streams thousands of messages, which
 * have to arrive in batches (one `postMessage` each would cost more than the
 * decoding), with their byte arrays transferred rather than copied. And a
 * read has to stop when the user collapses the topic, which needs a cancel
 * message by request id, since an `AbortSignal` cannot cross threads.
 *
 * Everything here survives structured cloning: plain objects, arrays,
 * typed arrays, strings, numbers and bigints (log times, int64 fields).
 */
import type {
    RecordingInsights,
    RecordingMetadata,
} from '../decoding-strategies/recording-insights';
import type {
    LogMessage,
    ReadOptions,
    SampleCostModel,
} from '../decoding-strategies/utilities';

export type FileKind = 'mcap' | 'rosbag' | 'db3';

/** What the preview knows about a file once its index is read. */
export interface OpenedFile {
    insights: RecordingInsights | null;
    /** The SQL schema of a `.db3`, null for other formats. */
    schema: string | null;
    /** Per topic, the input to `sampleCostOf`; see `sampleCostModels`. */
    sampleCostModels: Record<string, SampleCostModel | null>;
    /** Whether reads honour `ReadOptions.window` (playback windows). */
    supportsWindow: boolean;
}

/** `ReadOptions` as they cross the thread boundary. */
export interface WireReadOptions extends Omit<ReadOptions, 'skip'> {
    /** Log times of messages to skip; replaces the `skip` callback. */
    skipTimes?: BigInt64Array;
}

export interface ReadRequest {
    topic: string;
    limit: number;
    startTime?: bigint;
    options: WireReadOptions;
}

/** Calls the worker answers, with their parameters and result. */
export interface PreviewCalls {
    open: { params: { url: string; kind: FileKind }; result: OpenedFile };
    /** Streams `batch` responses, then answers with no value. */
    read: { params: ReadRequest; result: undefined };
    readAttachment: {
        params: { index: number };
        result: Uint8Array | undefined;
    };
    readMetadata: {
        params: Record<string, never>;
        result: RecordingMetadata[];
    };
    /** Drop the open file and stop its reads, freeing its memory. */
    close: { params: Record<string, never>; result: undefined };
}

export type CallName = keyof PreviewCalls;

export type PreviewRequest =
    | {
          [K in CallName]: {
              type: 'call';
              id: number;
              call: K;
              params: PreviewCalls[K]['params'];
          };
      }[CallName]
    | { type: 'cancel'; id: number };

export type PreviewResponse =
    /** Sent once by the worker after its module has loaded. */
    | { type: 'ready' }
    | { type: 'result'; id: number; value: unknown }
    | { type: 'error'; id: number; message: string }
    | { type: 'batch'; id: number; messages: LogMessage[] };

/** One side of a worker or `MessageChannel`, as both sides see it. */
export interface Endpoint {
    postMessage(message: unknown, transfer: Transferable[]): void;
    addEventListener(
        type: 'message',
        listener: (event: MessageEvent) => void,
    ): void;
    /** A `MessagePort` delivers nothing before this is called. */
    start?: () => void;
}
