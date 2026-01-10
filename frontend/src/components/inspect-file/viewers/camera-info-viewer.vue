<template>
    <div class="camera-info-viewer">
        <q-list separator class="bg-white rounded-borders border-color">
            <q-item
                v-for="(msg, idx) in messages"
                :key="idx"
                class="q-py-md column"
            >
                <div
                    class="row items-center q-mb-sm full-width justify-between"
                >
                    <div class="row items-center">
                        <q-badge color="grey-3" text-color="black">
                            <q-icon
                                name="sym_o_schedule"
                                size="xs"
                                class="q-mr-xs"
                            />
                            {{ formatTime(msg.logTime) }}
                        </q-badge>
                        <div class="text-subtitle2 q-ml-sm text-primary">
                            {{ msg.data.header?.frame_id || 'No Frame ID' }}
                        </div>
                    </div>
                    <q-btn
                        icon="sym_o_content_copy"
                        flat
                        round
                        dense
                        size="sm"
                        color="grey-7"
                        @click="() => copyRaw(msg.data)"
                    >
                        <q-tooltip>Copy raw JSON</q-tooltip>
                    </q-btn>
                </div>

                <div class="row q-col-gutter-md q-mb-md">
                    <div class="col-auto">
                        <div class="text-caption text-grey-7">Resolution</div>
                        <div class="text-body2 font-mono">
                            {{ msg.data.width }} x {{ msg.data.height }}
                        </div>
                    </div>
                    <div class="col-auto">
                        <div class="text-caption text-grey-7">
                            Distortion Model
                        </div>
                        <div class="text-body2 font-mono">
                            {{ msg.data.distortion_model }}
                        </div>
                    </div>
                    <div class="col-auto">
                        <div class="text-caption text-grey-7">
                            Binning (X, Y)
                        </div>
                        <div class="text-body2 font-mono">
                            {{ msg.data.binning_x }}, {{ msg.data.binning_y }}
                        </div>
                    </div>
                </div>

                <div class="row q-col-gutter-md">
                    <div class="col-12">
                        <div class="text-caption text-weight-bold q-mb-xs">
                            Distortion Coefficients (D)
                        </div>
                        <div
                            class="bg-grey-1 q-pa-sm rounded-borders font-mono text-caption break-word"
                        >
                            [ {{ formatD(msg.data.D) }} ]
                        </div>
                    </div>

                    <div class="col-12 col-md-4">
                        <div class="text-caption text-weight-bold q-mb-xs">
                            Intrinsic Matrix (K)
                        </div>
                        <div
                            class="matrix-grid-3x3 bg-grey-1 q-pa-sm rounded-borders"
                        >
                            <div
                                v-for="(val, i) in getArray(msg.data.K)"
                                :key="i"
                                class="matrix-cell font-mono text-caption"
                            >
                                {{ fmt(val) }}
                            </div>
                        </div>
                    </div>

                    <div class="col-12 col-md-4">
                        <div class="text-caption text-weight-bold q-mb-xs">
                            Rectification Matrix (R)
                        </div>
                        <div
                            class="matrix-grid-3x3 bg-grey-1 q-pa-sm rounded-borders"
                        >
                            <div
                                v-for="(val, i) in getArray(msg.data.R)"
                                :key="i"
                                class="matrix-cell font-mono text-caption"
                            >
                                {{ fmt(val) }}
                            </div>
                        </div>
                    </div>

                    <div class="col-12 col-md-4">
                        <div class="text-caption text-weight-bold q-mb-xs">
                            Projection Matrix (P)
                        </div>
                        <div
                            class="matrix-grid-3x4 bg-grey-1 q-pa-sm rounded-borders"
                        >
                            <div
                                v-for="(val, i) in getArray(msg.data.P)"
                                :key="i"
                                class="matrix-cell font-mono text-caption"
                            >
                                {{ fmt(val) }}
                            </div>
                        </div>
                    </div>
                </div>
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
                            </span>
                            available.
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
    if (!properties.messages || properties.messages.length === 0) {
        emit('load-required');
    }
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

// eslint-disable-next-line @typescript-eslint/naming-convention
const fmt = (number_: number): string => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (number_ === undefined || number_ === null) return '-';
    // If integer, show integer, else 4 decimals
    if (Number.isInteger(number_)) return String(number_);
    return number_.toFixed(4);
};

// Handle both Arrays and Object-style arrays {"0": val, "1": val}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getArray = (data: any): number[] => {
    if (!data) return [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (Array.isArray(data)) return data;
    // Convert object keys "0", "1", "2" to array
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        Object.keys(data)
            .map(Number)
            // eslint-disable-next-line unicorn/no-array-sort
            .sort((a, b) => a - b)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
            .map((k) => data[k])
    );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatD = (data: any): string => {
    const array = getArray(data);
    return array.map((v) => fmt(v)).join(', ');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function copyRaw(data: any): Promise<void> {
    await quasarCopy(JSON.stringify(data, null, 2));
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
.font-mono {
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
}
.break-word {
    word-break: break-all;
}

/* Matrix Grids */
.matrix-grid-3x3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
}
.matrix-grid-3x4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
}
.matrix-cell {
    text-align: center;
    padding: 2px;
    background: #fff;
    border-radius: 2px;
}
</style>
