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

            <div v-if="isLoading" class="row q-col-gutter-md">
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

            <div v-else class="row q-col-gutter-md">
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
import SimpleTimeChart, { ChartSeries } from './simple-time-chart.vue';
import SkeletonTimeChart from './skeleton-time-chart.vue';

const properties = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required']);

onMounted(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!properties.messages || properties.messages.length === 0)
        emit('load-required');
});

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);

const duration = computed(() => {
    if (properties.messages.length < 2) return 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const start = properties.messages[0].logTime;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const end = properties.messages.at(-1).logTime;
    return Number(end - start) / 1_000_000_000;
});

const startTime = computed(() => {
    if (properties.messages.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return properties.messages[0].logTime;
});

const frameId = computed(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    () => properties.messages[0]?.data?.header?.frame_id ?? '-',
);
const childFrameId = computed(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    () => properties.messages[0]?.data?.child_frame_id ?? '-',
);

const translationSeries = shallowRef<ChartSeries[]>([]);
const rotationSeries = shallowRef<ChartSeries[]>([]);

const updateCharts = debounce(() => {
    if (properties.messages.length === 0) {
        translationSeries.value = [];
        rotationSeries.value = [];
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const logStartTime = properties.messages[0].logTime;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const length_ = properties.messages.length;

    const t = new Float32Array(length_);
    const tx = new Float32Array(length_);
    const ty = new Float32Array(length_);
    const tz = new Float32Array(length_);

    const rx = new Float32Array(length_);
    const ry = new Float32Array(length_);
    const rz = new Float32Array(length_);
    const rw = new Float32Array(length_);

    for (let index = 0; index < length_; index++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const message = properties.messages[index];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        t[index] = Number(message.logTime - logStartTime) / 1_000_000_000;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const trans = message.data.transform?.translation ?? {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        tx[index] = trans.x ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        ty[index] = trans.y ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        tz[index] = trans.z ?? 0;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const rot = message.data.transform?.rotation ?? {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        rx[index] = rot.x ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        ry[index] = rot.y ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        rz[index] = rot.z ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        rw[index] = rot.w === undefined ? 1 : rot.w;
    }

    const makeData = (values: Float32Array) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any[] = Array.from({ length: length_ });
        for (let index = 0; index < length_; index++) {
            result[index] = { time: t[index], value: values[index] };
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const last = properties.messages.at(-1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
