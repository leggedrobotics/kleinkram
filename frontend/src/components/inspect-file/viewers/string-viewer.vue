<template>
    <div class="string-viewer">
        <div class="bg-white rounded-borders border-color">
            <div class="row justify-between items-center q-pa-md border-bottom">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="purple-1" text-color="purple-9">
                        {{ messages.length }} messages
                    </q-badge>
                </div>
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    round
                    dense
                    size="sm"
                    color="grey-7"
                    @click="copyRaw"
                >
                    <q-tooltip>Copy JSON</q-tooltip>
                </q-btn>
            </div>

            <q-list separator>
                <q-item
                    v-for="(msg, idx) in messages"
                    :key="idx"
                    class="q-py-sm"
                >
                    <q-item-section>
                        <div class="column q-gutter-y-xs">
                            <div class="text-caption text-grey-6 font-mono">
                                {{ formatTime(msg.logTime) }}
                            </div>

                            <div class="text-body2 text-grey-9 break-word">
                                {{ getDisplayText(msg.data.data) }}
                            </div>
                        </div>
                    </q-item-section>
                </q-item>
            </q-list>

            <div
                v-if="messages.length < totalCount"
                class="text-center q-pa-md bg-grey-1"
            >
                <div class="text-caption text-grey-7 q-mb-xs">
                    Showing {{ messages.length }} / {{ totalCount }} messages.
                </div>
                <q-btn
                    label="Load More"
                    icon="sym_o_download"
                    size="sm"
                    flat
                    color="primary"
                    @click="loadMore"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { onMounted } from 'vue';

const properties = defineProps<{
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);

onMounted(() => {
    if (!properties.messages || properties.messages.length === 0)
        emit('load-required');
});

// --- Truncation Logic ---
const MAX_LENGTH = 300;

const shouldTruncate = (text: string): boolean => {
    return text?.length > MAX_LENGTH;
};

const getDisplayText = (text: string): string => {
    if (!shouldTruncate(text)) {
        return text;
    }
    return text.slice(0, MAX_LENGTH) + '...';
};

// --- Formatters ---
const formatTime = (nano: bigint): string => {
    const ms = Number(nano / 1_000_000n);
    const date = new Date(ms);

    if (Number.isNaN(date.getTime())) {
        return 'Invalid Time';
    }

    const timePart = date.toISOString().split('T')[1];
    return timePart?.replace('Z', '') ?? 'Invalid Time';
};

async function copyRaw(): Promise<void> {
    await quasarCopy(JSON.stringify(properties.messages, null, 2));
    Notify.create({
        message: 'Data copied',
        color: 'positive',
        timeout: 1000,
    });
}

const loadMore = (): void => {
    emit('load-more');
};
</script>

<style scoped>
.border-color {
    border: 1px solid #e0e0e0;
}
.border-bottom {
    border-bottom: 1px solid #e0e0e0;
}
.font-mono {
    font-family: 'Roboto Mono', monospace;
}
.break-word {
    word-wrap: break-word;
    white-space: pre-wrap;
    word-break: break-all;
}
</style>
