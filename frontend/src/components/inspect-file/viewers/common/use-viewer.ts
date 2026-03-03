import { computed } from 'vue';

export interface BaseMessage {
    logTime: bigint;
    [key: string]: unknown;
}

export interface ViewerProperties<T extends BaseMessage = BaseMessage> {
    messages: T[];
    totalCount: number;
    topicName: string;
}

export function useViewer(messages: BaseMessage[]) {
    const startTime = computed(() => messages[0]?.logTime ?? 0n);

    const getNormalizedTime = (logTime: bigint): number => {
        return Number(logTime - startTime.value) / 1_000_000_000;
    };

    const duration = computed(() => {
        if (messages.length < 2) return 0;
        const end = messages.at(-1)?.logTime ?? startTime.value;
        return Number(end - startTime.value) / 1_000_000_000;
    });

    return {
        startTime,
        getNormalizedTime,
        duration,
    };
}
