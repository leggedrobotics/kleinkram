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

                            <div v-if="parseContent(msg.data.data).isJson">
                                <div
                                    v-if="parseContent(msg.data.data).prefix"
                                    class="text-body2 text-grey-9 break-word q-mb-xs"
                                >
                                    {{ parseContent(msg.data.data).prefix }}
                                </div>

                                <div
                                    class="bg-grey-1 q-pa-sm rounded-borders font-mono text-caption overflow-auto relative-position group"
                                    style="max-height: 300px"
                                >
                                    <pre class="q-ma-none">{{
                                        parseContent(msg.data.data).json
                                    }}</pre>
                                    <q-btn
                                        icon="sym_o_content_copy"
                                        flat
                                        round
                                        dense
                                        size="xs"
                                        color="grey-7"
                                        class="absolute-top-right q-ma-xs bg-white"
                                        @click="
                                            () =>
                                                copyText(
                                                    parseContent(msg.data.data)
                                                        .json,
                                                )
                                        "
                                    >
                                        <q-tooltip>Copy JSON</q-tooltip>
                                    </q-btn>
                                </div>

                                <div
                                    v-if="parseContent(msg.data.data).suffix"
                                    class="text-body2 text-grey-9 break-word q-mt-xs"
                                >
                                    {{ parseContent(msg.data.data).suffix }}
                                </div>
                            </div>

                            <!-- Plain Text View -->
                            <div
                                v-else
                                class="text-body2 text-grey-9 break-word"
                            >
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
                <SmoothLoading
                    :current="messages.length"
                    :total="totalCount"
                    message="Showing {current} / {total} messages."
                />
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
import SmoothLoading from '../../common/smooth-loading.vue';

const properties = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);

onMounted(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!properties.messages || properties.messages.length === 0)
        emit('load-required');
});

// --- JSON Logic ---

interface ParsedContent {
    prefix: string;
    json: string;
    suffix: string;
    isJson: boolean;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const parseContent = (string_: string): ParsedContent => {
    if (!string_ || typeof string_ !== 'string') {
        return { prefix: string_ || '', json: '', suffix: '', isJson: false };
    }

    // 1. Try full JSON first
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const object = JSON.parse(string_);
        return {
            prefix: '',
            json: JSON.stringify(object, null, 2),
            suffix: '',
            isJson: true,
        };
    } catch {
        // Continue to inline check
    }

    // 2. Try to find JSON object/array substring
    // Look for first { or [ and last } or ]
    const firstBrace = string_.indexOf('{');
    const firstBracket = string_.indexOf('[');
    let start = -1;

    if (firstBrace !== -1 && firstBracket !== -1) {
        start = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
        start = firstBrace;
    } else if (firstBracket !== -1) {
        start = firstBracket;
    }

    if (start === -1) {
        return { prefix: string_, json: '', suffix: '', isJson: false };
    }

    // Find end
    const lastBrace = string_.lastIndexOf('}');
    const lastBracket = string_.lastIndexOf(']');
    let end = -1;

    if (lastBrace !== -1 && lastBracket !== -1) {
        end = Math.max(lastBrace, lastBracket);
    } else if (lastBrace !== -1) {
        end = lastBrace;
    } else if (lastBracket !== -1) {
        end = lastBracket;
    }

    if (end === -1 || end <= start) {
        return { prefix: string_, json: '', suffix: '', isJson: false };
    }

    const potentialJson = string_.slice(start, end + 1);
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const object = JSON.parse(potentialJson);
        return {
            prefix: string_.slice(0, start),
            json: JSON.stringify(object, null, 2),
            suffix: string_.slice(end + 1),
            isJson: true,
        };
    } catch {
        return { prefix: string_, json: '', suffix: '', isJson: false };
    }
};

// --- Truncation Logic ---
const MAX_LENGTH = 300;

const shouldTruncate = (text: string): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return text?.length > MAX_LENGTH;
};

const getDisplayText = (text: string): string => {
    if (!shouldTruncate(text)) {
        return text;
    }
    return `${text.slice(0, MAX_LENGTH)}...`;
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
async function copyText(text: string): Promise<void> {
    await quasarCopy(text);
    Notify.create({
        message: 'Copied to clipboard',
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
