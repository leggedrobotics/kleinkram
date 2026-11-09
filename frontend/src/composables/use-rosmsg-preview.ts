import { UniversalHttpReader } from '@kleinkram/shared';
import { markRaw, reactive, Ref, ref, shallowRef } from 'vue';
import { DecodingStrategy } from '../services/decoding-strategies';
import { Db3Strategy } from '../services/decoding-strategies/db3-strategy';
import { McapStrategy } from '../services/decoding-strategies/mcap-strategy';
import { RosbagStrategy } from '../services/decoding-strategies/rosbag-strategy';
import type { ReadOptions } from '../services/decoding-strategies/utilities';
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
    reset: () => void;
    dbSchema?: Ref<string | null>;
} {
    const isReaderReady = ref(false);
    const readerError = ref<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topicPreviews = reactive<Record<string, any[]>>({});
    const topicLoadingState = reactive<Record<string, boolean>>({});

    const topicErrors = reactive<Record<string, string | null>>({});

    const strategy = shallowRef<DecodingStrategy | null>(null);
    const dbSchema = ref<string | null>(null);
    const abortControllers = new Map<string, AbortController>();

    function cancelTopic(topicName: string): void {
        const controller = abortControllers.get(topicName);
        if (controller) {
            controller.abort();
            abortControllers.delete(topicName);
            topicLoadingState[topicName] = false;
        }
    }

    function reset(): void {
        // Readiness belongs to the file that was loaded, so it has to clear
        // too: callers use it to decide whether a preview still needs loading.
        isReaderReady.value = false;
        readerError.value = null;
        dbSchema.value = null;
        for (const controller of abortControllers.values()) {
            controller.abort();
        }
        abortControllers.clear();
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

        try {
            const httpReader = new UniversalHttpReader(url);
            await httpReader.init();

            let impl: DecodingStrategy;
            if (type === 'mcap') impl = new McapStrategy();
            else if (type === 'db3') {
                impl = new Db3Strategy();
                await impl.init(httpReader);
                dbSchema.value = impl.getSchema();
            } else impl = new RosbagStrategy();

            if (type !== 'db3') {
                await impl.init(httpReader);
            }

            strategy.value = impl;
            isReaderReady.value = true;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error('Preview init failed:', error);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            readerError.value = error.message;
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
        if (!strategy.value) return;

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
        const readOptions: ReadOptions = { stride, progressive };
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
        const loadedTimes = merge
            ? new Set<bigint>(
                  (topicPreviews[topicName] ?? []).map(
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
                      (message) => message.logTime,
                  ),
              )
            : undefined;

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
            // We ignore the return value (full array) because we populate
            // the reactive array via the callback for immediate UI feedback.
            await strategy.value.getMessages(
                topicName,
                limit,
                (message) => {
                    if (controller.signal.aborted) return;
                    // Use markRaw to prevent deep reactivity overhead
                    batcher.add(markRaw(message));
                },
                controller.signal,
                startTime,
                loadedTimes
                    ? {
                          ...readOptions,
                          skip: (logTime): boolean => loadedTimes.has(logTime),
                      }
                    : readOptions,
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

    return {
        isReaderReady,
        readerError,
        topicPreviews,
        topicLoadingState,
        topicErrors,
        dbSchema,
        init,
        fetchTopicMessages,
        formatPayload,
        cancelTopic,
        reset,
    };
}
