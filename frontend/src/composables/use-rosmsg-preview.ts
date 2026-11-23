import {
    getCurrentScope,
    markRaw,
    onScopeDispose,
    reactive,
    Ref,
    ref,
    shallowRef,
} from 'vue';
import type {
    RecordingInsights,
    RecordingMetadata,
} from '../services/decoding-strategies/recording-insights';
import {
    type LogMessage,
    type SampleCostModel,
    sampleCostOf,
} from '../services/decoding-strategies/utilities';
import { PreviewClient } from '../services/preview-worker/client';
import type { WireReadOptions } from '../services/preview-worker/protocol';
import { formatPayload } from './rosmsg-utilities.ts';

export interface FetchOptions {
    limit?: number;
    /** Continue after the last loaded message (paging) */
    append?: boolean;
    /** Keep only every n-th message */
    stride?: number;
    /** Read chunks coarse-to-fine so the whole recording is covered early */
    progressive?: boolean;
    /**
     * Keep the messages already loaded and add the new ones in time order,
     * skipping messages that are already present. Used to refine a sampled
     * topic with a smaller stride.
     */
    merge?: boolean;
    /** Total number of messages of the topic, for uniform sampling */
    totalMessages?: number;
}

/** The part of a decoded message this module needs to order the previews. */
interface TimedMessage {
    logTime: bigint;
}

/**
 * How long decoded messages are buffered before they reach the UI.
 * Appending one at a time makes every viewer re-render — and re-derive its
 * tracks, series and SVG paths over the whole array — once per message,
 * which is what froze the page while a topic loaded. At ten batches per
 * second the progress counter still moves visibly.
 */
const FLUSH_INTERVAL_MS = 100;

/**
 * Seconds of full-rate frames kept behind the playhead. Scrubbing back a
 * little stays smooth; anything older is dropped, so playing through a long
 * recording does not accumulate every frame in memory.
 */
const WINDOW_KEEP_BEHIND_NS = 2_000_000_000n;

/** Message objects as the previews hold them. */
interface PreviewMessage extends TimedMessage {
    /** Filled in around the playhead, not part of the sample. */
    dense?: boolean;
}

/**
 * Merges a batch of freshly decoded messages into the ones already loaded,
 * keeping the result ordered by log time. Returns a new array so that the
 * reactive store is written once per batch instead of once per message.
 */
function mergeBatch(
    loaded: TimedMessage[],
    batch: TimedMessage[],
    dedupeByTime: boolean,
): TimedMessage[] {
    if (batch.length === 0) return loaded;
    batch.sort((a, b) => {
        if (a.logTime === b.logTime) return 0;
        return a.logTime < b.logTime ? -1 : 1;
    });

    // Sequential loading delivers messages in time order, so the batch
    // usually belongs at the end; progressive (coarse-to-fine) loading
    // delivers them out of order and needs the full merge below.
    const last = loaded.at(-1);
    const first = batch[0];
    if (
        last === undefined ||
        (first !== undefined && last.logTime < first.logTime)
    ) {
        return [...loaded, ...batch];
    }

    const merged: TimedMessage[] = [];
    // When refining an already sampled topic, a message whose log time is
    // present already is one that was loaded before; distinct records with
    // equal timestamps are kept during ordinary loads.
    const appendFromBatch = (message: TimedMessage): void => {
        if (dedupeByTime && merged.at(-1)?.logTime === message.logTime) return;
        merged.push(message);
    };

    let read = 0;
    let write = 0;
    while (read < loaded.length && write < batch.length) {
        const existing = loaded[read];
        const incoming = batch[write];
        if (
            existing !== undefined &&
            incoming !== undefined &&
            incoming.logTime < existing.logTime
        ) {
            appendFromBatch(incoming);
            write++;
        } else {
            if (existing !== undefined) merged.push(existing);
            read++;
        }
    }
    for (; read < loaded.length; read++) {
        const existing = loaded[read];
        if (existing !== undefined) merged.push(existing);
    }
    for (; write < batch.length; write++) {
        const incoming = batch[write];
        if (incoming !== undefined) appendFromBatch(incoming);
    }
    return merged;
}

interface MessageBatcher {
    add: (message: TimedMessage) => void;
    /** Hands over whatever is buffered right away */
    flush: () => void;
    /** Drops the buffer and any pending flush */
    cancel: () => void;
}

/**
 * Buffers decoded messages and hands them to `commit` at most every
 * FLUSH_INTERVAL_MS, so that decoding a topic does not re-render the
 * viewers once per message.
 */
function createMessageBatcher(
    commit: (batch: TimedMessage[]) => void,
    isCancelled: () => boolean,
): MessageBatcher {
    const pending: TimedMessage[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clear = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
    };

    const flush = (): void => {
        clear();
        // A flush that was scheduled before the topic got cancelled must
        // not write into the preview of the load that replaced it.
        if (isCancelled() || pending.length === 0) return;
        commit(pending.splice(0));
    };

    return {
        add: (message: TimedMessage): void => {
            pending.push(message);
            timer ??= setTimeout(flush, FLUSH_INTERVAL_MS);
        },
        flush,
        cancel: (): void => {
            clear();
            pending.length = 0;
        },
    };
}

export function useRosmsgPreview(): {
    isReaderReady: Ref<boolean, boolean>;
    readerError: Ref<string | null, string | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topicPreviews: Record<string, any[]>;
    topicLoadingState: Record<string, boolean>;
    topicErrors: Record<string, string | null>;
    init: (
        url: string,
        type: 'mcap' | 'rosbag' | 'db3',
        missionUuid?: string,
    ) => Promise<void>;
    fetchTopicMessages: (
        topicName: string,
        options?: FetchOptions,
    ) => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formatPayload: (data: any) => string;
    cancelTopic: (topicName: string) => void;
    /** Bytes a sampled read of a topic downloads at this stride. */
    sampleCost: (topicName: string, stride: number) => number | undefined;
    /**
     * Load every message of a topic in [from, until), keeping only the full-
     * rate frames between `playhead` minus a short margin and `until`.
     */
    fetchTopicWindow: (
        topicName: string,
        from: bigint,
        until: bigint,
        playhead: bigint,
        onFailed?: () => void,
    ) => Promise<void>;
    reset: () => void;
    dbSchema?: Ref<string | null>;
    insights: Ref<RecordingInsights | null>;
    readAttachment: (index: number) => Promise<Uint8Array | undefined>;
    readMetadata: () => Promise<RecordingMetadata[]>;
} {
    const isReaderReady = ref(false);
    const readerError = ref<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topicPreviews = reactive<Record<string, any[]>>({});
    const topicLoadingState = reactive<Record<string, boolean>>({});

    const topicErrors = reactive<Record<string, string | null>>({});

    // Reading, decompressing and decoding the file all happen in a worker;
    // this thread only receives decoded messages. Started on the first file.
    let client: PreviewClient | undefined;
    const getClient = (): PreviewClient => (client ??= new PreviewClient());
    if (getCurrentScope()) {
        onScopeDispose(() => {
            client?.dispose();
            client = undefined;
        });
    }
    /** Counts `init` calls, so a slow one cannot replace a newer file. */
    let generation = 0;
    let costModels: Record<string, SampleCostModel | null> = {};
    /** Whether the open file's reader honours `ReadOptions.window`. */
    let supportsWindow = false;
    const dbSchema = ref<string | null>(null);
    // Holds bigints and large maps that nothing mutates, so it is not made
    // deeply reactive.
    const insights = shallowRef<RecordingInsights | null>(null);
    const abortControllers = new Map<string, AbortController>();
    const windowControllers = new Map<string, AbortController>();
    const sampleCosts = new Map<string, number | undefined>();

    // Priced here from the model the worker sent when the file opened, so
    // the topic table can search strides synchronously.
    function sampleCost(topicName: string, stride: number): number | undefined {
        if (!isReaderReady.value) return undefined;
        const model = costModels[topicName];
        if (!model) return undefined;
        const key = `${topicName}\u0000${String(stride)}`;
        let cost = sampleCosts.get(key);
        if (cost === undefined) {
            cost = sampleCostOf(model, stride);
            sampleCosts.set(key, cost);
        }
        return cost;
    }

    function cancelTopic(topicName: string): void {
        windowControllers.get(topicName)?.abort();
        windowControllers.delete(topicName);
        const controller = abortControllers.get(topicName);
        if (controller) {
            controller.abort();
            abortControllers.delete(topicName);
            topicLoadingState[topicName] = false;
        }
    }

    function reset(): void {
        // Whatever file is still opening is not wanted any more
        generation++;
        // Readiness belongs to the file that was loaded, so it has to clear
        // too: callers use it to decide whether a preview still needs loading.
        isReaderReady.value = false;
        readerError.value = null;
        dbSchema.value = null;
        insights.value = null;
        costModels = {};
        supportsWindow = false;
        // The worker would otherwise keep the old file's index and caches
        // until the next file opens, or forever if none does.
        client?.close();
        for (const controller of [
            ...abortControllers.values(),
            ...windowControllers.values(),
        ]) {
            controller.abort();
        }
        abortControllers.clear();
        windowControllers.clear();
        sampleCosts.clear();
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        for (const k of Object.keys(topicPreviews)) delete topicPreviews[k];

        for (const k of Object.keys(topicLoadingState)) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete topicLoadingState[k];
        }
    }

    async function init(
        url: string,
        type: 'mcap' | 'rosbag' | 'db3',
    ): Promise<void> {
        reset();
        // Clear previous errors on new file load
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        for (const k of Object.keys(topicErrors)) delete topicErrors[k];

        const current = ++generation;
        try {
            const opened = await getClient().open({ url, kind: type });
            if (current !== generation) return;
            if (type === 'db3') dbSchema.value = opened.schema;
            costModels = opened.sampleCostModels;
            supportsWindow = opened.supportsWindow;
            insights.value = opened.insights;
            isReaderReady.value = true;
        } catch (error: unknown) {
            if (current !== generation) return;
            console.error('Preview init failed:', error);
            readerError.value =
                error instanceof Error ? error.message : String(error);
        }
    }

    /**
     * Fetches messages for a topic.
     * Uses streaming to populate the array as data arrives.
     */
    async function fetchTopicMessages(
        topicName: string,
        options?: FetchOptions,
    ): Promise<void> {
        if (!client || !isReaderReady.value) return;

        // Cancel any existing request for this topic
        cancelTopic(topicName);

        const controller = new AbortController();
        abortControllers.set(topicName, controller);

        topicLoadingState[topicName] = true;
        topicErrors[topicName] = null;

        const limit = options?.limit ?? 10;
        const append = options?.append ?? false;
        const stride = options?.stride ?? 1;
        const progressive = options?.progressive ?? false;
        const merge = options?.merge ?? false;
        const readOptions: WireReadOptions = { stride, progressive };
        if (options?.totalMessages !== undefined) {
            readOptions.totalMessages = options.totalMessages;
        }

        let startTime: bigint | undefined;

        if (append) {
            // Calculate start time from the last message
            const currentMessages = topicPreviews[topicName];
            if (currentMessages && currentMessages.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const lastMessage = currentMessages.at(-1);
                // Add 1ns to avoid duplicate of the last message
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                startTime = BigInt(lastMessage.logTime) + 1n;
            }
        } else if (!merge) {
            // Reset the array so it can be filled from scratch
            topicPreviews[topicName] = [];
        }

        // When merging, do not decode messages that are already loaded
        if (merge) {
            readOptions.skipTimes = BigInt64Array.from(
                (topicPreviews[topicName] ?? []) as TimedMessage[],
                (message) => message.logTime,
            );
        }

        const batcher = createMessageBatcher(
            (batch) => {
                topicPreviews[topicName] = mergeBatch(
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    topicPreviews[topicName] ?? [],
                    batch,
                    merge,
                );
            },
            () => controller.signal.aborted,
        );

        try {
            // Messages arrive in batches and populate the reactive array as
            // they come, for immediate UI feedback.
            await client.read(
                startTime === undefined
                    ? { topic: topicName, limit, options: readOptions }
                    : {
                          topic: topicName,
                          limit,
                          startTime,
                          options: readOptions,
                      },
                (messages) => {
                    if (controller.signal.aborted) return;
                    // Use markRaw to prevent deep reactivity overhead
                    for (const message of messages) {
                        batcher.add(markRaw(message));
                    }
                },
                controller.signal,
            );
        } catch (error: unknown) {
            if (controller.signal.aborted) return; // Ignore abort errors

            console.error(`Error reading ${topicName}`, error);
            // Don't necessarily clear previews on error, we might have partial data
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            if (!topicPreviews[topicName]) topicPreviews[topicName] = [];

            topicErrors[topicName] =
                error instanceof Error ? error.message : String(error);
        } finally {
            if (controller.signal.aborted) {
                batcher.cancel();
            } else {
                batcher.flush();
                topicLoadingState[topicName] = false;
                abortControllers.delete(topicName);
            }
        }
    }

    async function fetchTopicWindow(
        topicName: string,
        from: bigint,
        until: bigint,
        playhead: bigint,
        onFailed?: () => void,
    ): Promise<void> {
        // Formats without windowed reads would read the whole topic each time
        if (!client || !isReaderReady.value || !supportsWindow) return;
        windowControllers.get(topicName)?.abort();
        const controller = new AbortController();
        windowControllers.set(topicName, controller);

        // Drop full-rate frames the playhead has left behind; the sample
        // across the recording stays
        const keepFrom = playhead - WINDOW_KEEP_BEHIND_NS;
        const current = (topicPreviews[topicName] ?? []) as PreviewMessage[];
        const kept = current.filter(
            (message) =>
                !message.dense ||
                (message.logTime >= keepFrom && message.logTime < until),
        );
        if (kept.length !== current.length) topicPreviews[topicName] = kept;

        const batcher = createMessageBatcher(
            (batch) => {
                topicPreviews[topicName] = mergeBatch(
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    topicPreviews[topicName] ?? [],
                    batch,
                    true,
                );
            },
            () => controller.signal.aborted,
        );

        try {
            await client.read(
                {
                    topic: topicName,
                    limit: Number.MAX_SAFE_INTEGER,
                    options: {
                        window: { start: from, end: until },
                        skipTimes: BigInt64Array.from(
                            kept,
                            (message) => message.logTime,
                        ),
                    },
                },
                (messages: LogMessage[]) => {
                    if (controller.signal.aborted) return;
                    for (const message of messages) {
                        batcher.add(markRaw({ ...message, dense: true }));
                    }
                },
                controller.signal,
            );
        } catch (error: unknown) {
            // The sample stays usable, playback just shows fewer frames
            if (!controller.signal.aborted) {
                console.warn(`Error reading ${topicName} ahead`, error);
                onFailed?.();
            }
        } finally {
            if (controller.signal.aborted) {
                batcher.cancel();
            } else {
                batcher.flush();
                windowControllers.delete(topicName);
            }
        }
    }

    return {
        isReaderReady,
        readerError,
        topicPreviews,
        topicLoadingState,
        topicErrors,
        dbSchema,
        insights,
        readAttachment: (index: number): Promise<Uint8Array | undefined> =>
            client?.readAttachment(index) ?? Promise.resolve(undefined),
        readMetadata: (): Promise<RecordingMetadata[]> =>
            client?.readMetadata() ?? Promise.resolve([]),
        init,
        fetchTopicMessages,
        formatPayload,
        cancelTopic,
        sampleCost,
        fetchTopicWindow,
        reset,
    };
}
