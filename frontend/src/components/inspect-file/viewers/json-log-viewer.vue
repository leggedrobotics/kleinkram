<template>
    <div class="json-log-viewer">
        <q-list separator class="bg-white rounded-borders border-color">
            <q-item
                v-for="(msg, idx) in messages"
                :key="idx"
                class="q-py-md items-start"
            >
                <q-item-section side style="min-width: 150px">
                    <div class="text-caption text-weight-bold text-primary">
                        {{ formatTime(msg.logTime) }}
                    </div>
                    <div class="text-caption text-grey-6">
                        {{ getByteSize(msg.data) }} bytes
                    </div>
                </q-item-section>

                <q-item-section>
                    <div class="relative-position group">
                        <div
                            class="code-container bg-grey-1 q-pa-sm rounded-borders"
                        >
                            <pre class="code-content">{{
                                formatContent(msg.data)
                            }}</pre>
                        </div>
                        <div
                            class="absolute-top-right q-pa-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <q-btn
                                icon="sym_o_content_copy"
                                flat
                                round
                                dense
                                size="sm"
                                color="grey-7"
                                @click="() => copyToClipboard(msg.data)"
                            >
                                <q-tooltip>Copy raw JSON</q-tooltip>
                            </q-btn>
                        </div>
                    </div>
                </q-item-section>
            </q-item>

            <q-item
                v-if="messages.length < totalCount"
                class="q-py-md bg-grey-1 text-center"
            >
                <q-item-section>
                    <div class="row justify-center items-center q-gutter-sm">
                        <div class="text-caption text-grey-7">
                            <q-icon
                                name="sym_o_info"
                                size="xs"
                                class="q-mr-xs"
                            />
                            Showing first {{ messages.length }} messages.
                            <span class="text-weight-bold">
                                {{ totalCount - messages.length }} additional
                                messages
                            </span>
                            are available.
                        </div>
                        <q-btn
                            label="Load more"
                            icon="sym_o_download"
                            size="sm"
                            flat
                            color="primary"
                            dense
                            @click="loadMore"
                        />
                    </div>
                </q-item-section>
            </q-item>
        </q-list>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { onMounted } from 'vue';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getByteSize = (data: any): number => {
    if (!data) return 0;
    if (data instanceof Uint8Array) return data.byteLength;
    return JSON.stringify(data, replacer).length;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatContent = (data: any): string => {
    if (data === null) return '[Empty]';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (data instanceof Uint8Array || data?.type === 'Buffer')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions
        return `[Binary Data] Size: ${data.byteLength ?? 0} bytes`;
    try {
        const jsonString = JSON.stringify(data, replacer, 2);
        return jsonString.length > 2000
            ? `${jsonString.slice(0, 2000)}\n... [Truncated]`
            : jsonString;
    } catch {
        return String(data);
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const replacer = (_key: string, value: any) => {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Array.isArray(value) && value.length > 20
        ? // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `[Array(${value.length})]`
        : value;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function copyToClipboard(data: any): Promise<void> {
    await quasarCopy(JSON.stringify(data, replacer, 2));
    Notify.create({
        message: 'Payload copied',
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
.code-content {
    margin: 0;
    font-family: monospace;
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-all;
    color: #444;
}
.group:hover .opacity-0 {
    opacity: 1;
}
.opacity-0 {
    opacity: 0;
}
.transition-opacity {
    transition: opacity 0.2s ease;
}
</style>
