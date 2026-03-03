<template>
    <div class="transform-stamped-viewer">
        <div
            class="bg-white rounded-borders border-color q-pa-md transition-generic"
        >
            <div class="row justify-between items-center q-mb-md">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="purple-1" text-color="purple-9">
                        <q-icon
                            name="sym_o_timeline"
                            size="xs"
                            class="q-mr-xs"
                        />
                        {{ duration.toFixed(2) }}s
                    </q-badge>
                    <q-badge color="blue-1" text-color="blue-9">
                        {{ messages.length }} Messages
                    </q-badge>
                    <q-spinner-dots
                        v-if="isLoading"
                        color="primary"
                        size="1em"
                    />
                </div>
                <div class="row items-center q-gutter-x-sm">
                    <q-badge outline color="grey-7">
                        Frame: {{ frameId }}
                    </q-badge>
                    <q-badge outline color="grey-7">
                        Child: {{ childFrameId }}
                    </q-badge>
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
            </div>

            <div v-if="isLoading" key="loading" class="row q-col-gutter-md">
                <div class="col-12">
                    <SkeletonTimeChart
                        title="Translation (m)"
                        :current="messages.length"
                        :total="totalCount"
                    />
                </div>
                <div class="col-12">
                    <SkeletonTimeChart
                        title="Rotation (Quaternion)"
                        :current="messages.length"
                        :total="totalCount"
                    />
                </div>
            </div>

            <div v-else key="loaded" class="row q-col-gutter-md">
                <!-- Translation -->
                <div class="col-12">
                    <SimpleTimeChart
                        title="Translation (m)"
                        :series="translationSeries"
                        y-axis-label="m"
                        :height="200"
                        :start-time="startTime"
                    />
                </div>
                <!-- Rotation -->
                <div class="col-12">
                    <SimpleTimeChart
                        title="Rotation (Quaternion)"
                        :series="rotationSeries"
                        y-axis-label="val"
                        :height="200"
                        :start-time="startTime"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { debounce, Notify, copyToClipboard as quasarCopy } from 'quasar';
import { computed, markRaw, onMounted, shallowRef, watch } from 'vue';
import { useViewer, type BaseMessage } from './common/use-viewer';
import SimpleTimeChart, { type ChartSeries } from './simple-time-chart.vue';
import SkeletonTimeChart from './skeleton-time-chart.vue';

interface Vector3 {
    x?: number;
    y?: number;
    z?: number;
}

interface Quaternion {
    x?: number;
    y?: number;
    z?: number;
    w?: number;
}

interface TransformMessage extends BaseMessage {
    data: {
        header?: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            frame_id?: string;
        };
        // eslint-disable-next-line @typescript-eslint/naming-convention
        child_frame_id?: string;
        transform?: {
            translation?: Vector3;
            rotation?: Quaternion;
        };
    };
}

const properties = defineProps<{
    messages: TransformMessage[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required']);

onMounted(() => {
    if (properties.messages.length === 0) {
        emit('load-required');
    }
});

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);

const { startTime, getNormalizedTime, duration } = useViewer(
    properties.messages,
);

const frameId = computed(
    () => properties.messages[0]?.data.header?.frame_id ?? '-',
);
const childFrameId = computed(
    () => properties.messages[0]?.data.child_frame_id ?? '-',
);

const translationSeries = shallowRef<ChartSeries[]>([]);
const rotationSeries = shallowRef<ChartSeries[]>([]);

const updateCharts = debounce(() => {
    if (properties.messages.length === 0) {
        translationSeries.value = [];
        rotationSeries.value = [];
        return;
    }

    const messageLength = properties.messages.length;

    const t = new Float32Array(messageLength);
    const tx = new Float32Array(messageLength);
    const ty = new Float32Array(messageLength);
    const tz = new Float32Array(messageLength);

    const rx = new Float32Array(messageLength);
    const ry = new Float32Array(messageLength);
    const rz = new Float32Array(messageLength);
    const rw = new Float32Array(messageLength);

    for (let index = 0; index < messageLength; index++) {
        const message = properties.messages[index];
        if (!message) continue;

        t[index] = getNormalizedTime(message.logTime);

        const trans = message.data.transform?.translation ?? {};
        tx[index] = trans.x ?? 0;
        ty[index] = trans.y ?? 0;
        tz[index] = trans.z ?? 0;

        const rot = message.data.transform?.rotation ?? {};
        rx[index] = rot.x ?? 0;
        ry[index] = rot.y ?? 0;
        rz[index] = rot.z ?? 0;
        rw[index] = rot.w ?? 1;
    }

    const makeData = (values: Float32Array) => {
        const result: { time: number; value: number }[] = Array.from({
            length: messageLength,
        });
        for (let index = 0; index < messageLength; index++) {
            const timeValue = t[index];
            const value = values[index];
            result[index] = { time: timeValue ?? 0, value: value ?? 0 };
        }
        return result;
    };

    translationSeries.value = markRaw([
        { name: 'X', color: '#F44336', data: makeData(tx) },
        { name: 'Y', color: '#4CAF50', data: makeData(ty) },
        { name: 'Z', color: '#2196F3', data: makeData(tz) },
    ]);

    rotationSeries.value = markRaw([
        { name: 'X', color: '#FF9800', data: makeData(rx) },
        { name: 'Y', color: '#8BC34A', data: makeData(ry) },
        { name: 'Z', color: '#03A9F4', data: makeData(rz) },
        { name: 'W', color: '#9C27B0', data: makeData(rw) },
    ]);
}, 500);

watch(() => properties.messages.length, updateCharts, { immediate: true });

async function copyRaw(): Promise<void> {
    if (properties.messages.length === 0) return;
    const last = properties.messages.at(-1);
    if (!last) return;
    await quasarCopy(JSON.stringify(last.data, null, 2));
    Notify.create({
        message: 'Latest message copied',
        color: 'positive',
        timeout: 1000,
    });
}
</script>

<style scoped>
.border-color {
    border: 1px solid #e0e0e0;
}

.skeleton-path {
    animation: dash 2s linear infinite;
    stroke-dasharray: 50;
    stroke-dashoffset: 1000;
}

@keyframes dash {
    to {
        stroke-dashoffset: 0;
    }
}
</style>
