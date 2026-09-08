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

/**
 * Inserts a message keeping the array ordered by log time. Appending is the
 * fast path; progressive (coarse-to-fine) loading delivers messages out of
 * order and falls back to a binary search for the insertion point.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function insertSorted(messages: any[], message: { logTime: bigint }): void {
    const last = messages.at(-1) as { logTime: bigint } | undefined;
    if (last === undefined || last.logTime < message.logTime) {
        messages.push(message);
        return;
    }
    let low = 0;
    let high = messages.length;
    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const midMessage = messages[mid] as { logTime: bigint };
        if (midMessage.logTime < message.logTime) low = mid + 1;
        else high = mid;
    }
    // Ignore exact duplicates (same log time) when merging refinements
    const existing = messages[low] as { logTime: bigint } | undefined;
    if (existing?.logTime === message.logTime) return;
    messages.splice(low, 0, message);
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
        isReaderReady.value = false;
        readerError.value = null;
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

        try {
            // We ignore the return value (full array) because we populate
            // the reactive array via the callback for immediate UI feedback.
            await strategy.value.getMessages(
                topicName,
                limit,
                (message) => {
                    if (controller.signal.aborted) return;
                    // Use markRaw to prevent deep reactivity overhead
                    insertSorted(
                        (topicPreviews[topicName] ??= []),
                        markRaw(message),
                    );
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
            if (!controller.signal.aborted) {
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
