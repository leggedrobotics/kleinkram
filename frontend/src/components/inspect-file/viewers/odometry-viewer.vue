<template>
    <div class="odometry-viewer">
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
                        title="Position (m)"
                        :current="messages.length"
                        :total="totalCount"
                    />
                </div>
                <div class="col-12 col-md-6">
                    <SkeletonTimeChart
                        title="Linear Velocity (m/s)"
                        :current="messages.length"
                        :total="totalCount"
                    />
                </div>
                <div class="col-12 col-md-6">
                    <SkeletonTimeChart
                        title="Angular Velocity (rad/s)"
                        :current="messages.length"
                        :total="totalCount"
                    />
                </div>
            </div>

            <div v-else class="row q-col-gutter-md">
                <!-- Position -->
                <div class="col-12">
                    <SimpleTimeChart
                        title="Position (m)"
                        :series="positionSeries"
                        y-axis-label="m"
                        :height="200"
                        :start-time="startTime"
                    />
                </div>

                <!-- Linear Velocity -->
                <div class="col-12 col-md-6">
                    <SimpleTimeChart
                        title="Linear Velocity (m/s)"
                        :series="linearVelSeries"
                        y-axis-label="m/s"
                        :height="200"
                        :start-time="startTime"
                    />
                </div>

                <!-- Angular Velocity -->
                <div class="col-12 col-md-6">
                    <SimpleTimeChart
                        title="Angular Velocity (rad/s)"
                        :series="angularVelSeries"
                        y-axis-label="rad/s"
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
    return (end - start) / 1_000_000_000;
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

const positionSeries = shallowRef<ChartSeries[]>([]);
const linearVelSeries = shallowRef<ChartSeries[]>([]);
const angularVelSeries = shallowRef<ChartSeries[]>([]);

const updateCharts = debounce(() => {
    if (properties.messages.length === 0) {
        positionSeries.value = [];
        linearVelSeries.value = [];
        angularVelSeries.value = [];
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const logStartTime = properties.messages[0].logTime;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const length_ = properties.messages.length;

    const t = new Float32Array(length_);
    const px = new Float32Array(length_);
    const py = new Float32Array(length_);
    const pz = new Float32Array(length_);
    const lvx = new Float32Array(length_);
    const lvy = new Float32Array(length_);
    const lvz = new Float32Array(length_);
    const avx = new Float32Array(length_);
    const avy = new Float32Array(length_);
    const avz = new Float32Array(length_);

    for (let index = 0; index < length_; index++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const message = properties.messages[index];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        t[index] = (message.logTime - logStartTime) / 1_000_000_000;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const pos = message.data.pose?.pose?.position ?? {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        px[index] = pos.x ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        py[index] = pos.y ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        pz[index] = pos.z ?? 0;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const twist = message.data.twist?.twist ?? {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const lin = twist.linear ?? {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const ang = twist.angular ?? {};

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        lvx[index] = lin.x ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        lvy[index] = lin.y ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        lvz[index] = lin.z ?? 0;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        avx[index] = ang.x ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        avy[index] = ang.y ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        avz[index] = ang.z ?? 0;
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

    positionSeries.value = markRaw([
        { name: 'X', color: '#F44336', data: makeData(px) },
        { name: 'Y', color: '#4CAF50', data: makeData(py) },
        { name: 'Z', color: '#2196F3', data: makeData(pz) },
    ]);

    linearVelSeries.value = markRaw([
        { name: 'X', color: '#FF9800', data: makeData(lvx) },
        { name: 'Y', color: '#9C27B0', data: makeData(lvy) },
        { name: 'Z', color: '#00BCD4', data: makeData(lvz) },
    ]);

    angularVelSeries.value = markRaw([
        { name: 'X', color: '#795548', data: makeData(avx) },
        { name: 'Y', color: '#607D8B', data: makeData(avy) },
        { name: 'Z', color: '#E91E63', data: makeData(avz) },
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
