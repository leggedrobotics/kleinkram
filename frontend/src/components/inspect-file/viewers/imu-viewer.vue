<template>
    <div class="imu-viewer">
        <div
            class="bg-white rounded-borders border-color q-pa-md transition-generic"
        >
            <div class="row justify-between items-center q-mb-md">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="blue-3" text-color="blue-9">
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

            <div v-if="messages.length === 0" class="row q-col-gutter-md">
                <div v-for="i in 2" :key="i" class="col-12">
                    <!-- Skeleton ... -->
                    <div
                        class="skeleton-graph rounded-borders overflow-hidden relative-position"
                        style="height: 200px; border: 1px solid #eee"
                    >
                        <div class="absolute-full flex flex-center text-grey-4">
                            <SmoothLoading
                                :current="0"
                                :total="totalCount"
                                message="Initializing..."
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="isLoading" class="row q-col-gutter-md">
                <div class="col-12">
                    <SkeletonTimeChart
                        title="Linear Acceleration (m/s²)"
                        :current="messages.length"
                        :total="totalCount"
                    />
                </div>
                <div class="col-12">
                    <SkeletonTimeChart
                        title="Angular Velocity (rad/s)"
                        :current="messages.length"
                        :total="totalCount"
                    />
                </div>
            </div>

            <div v-else class="row q-col-gutter-md">
                <!-- Linear Acceleration -->
                <div class="col-12">
                    <SimpleTimeChart
                        title="Linear Acceleration (m/s²)"
                        :series="accelSeries"
                        y-axis-label="m/s²"
                        :height="200"
                        :start-time="startTime"
                    />
                </div>

                <!-- Angular Velocity -->
                <div class="col-12">
                    <SimpleTimeChart
                        title="Angular Velocity (rad/s)"
                        :series="gyroSeries"
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
import { computed, markRaw, shallowRef, watch } from 'vue';
import SmoothLoading from '../../common/smooth-loading.vue';
import SimpleTimeChart, { ChartSeries } from './simple-time-chart.vue';
import SkeletonTimeChart from './skeleton-time-chart.vue';

const properties = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

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

const accelSeries = shallowRef<ChartSeries[]>([]);
const gyroSeries = shallowRef<ChartSeries[]>([]);

const updateCharts = debounce(() => {
    if (properties.messages.length === 0) {
        accelSeries.value = [];
        gyroSeries.value = [];
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const startTime = properties.messages[0].logTime;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const length_ = properties.messages.length;

    const t = new Float32Array(length_);
    const ax = new Float32Array(length_);
    const ay = new Float32Array(length_);
    const az = new Float32Array(length_);
    const gx = new Float32Array(length_);
    const gy = new Float32Array(length_);
    const gz = new Float32Array(length_);

    for (let index = 0; index < length_; index++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const message = properties.messages[index];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        t[index] = (message.logTime - startTime) / 1_000_000_000;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const accumulator = message.data.linear_acceleration ?? {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        ax[index] = accumulator.x ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        ay[index] = accumulator.y ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        az[index] = accumulator.z ?? 0;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const ang = message.data.angular_velocity ?? {};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        gx[index] = ang.x ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        gy[index] = ang.y ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        gz[index] = ang.z ?? 0;
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

    accelSeries.value = markRaw([
        { name: 'X', color: '#F44336', data: makeData(ax) },
        { name: 'Y', color: '#4CAF50', data: makeData(ay) },
        { name: 'Z', color: '#2196F3', data: makeData(az) },
    ]);

    gyroSeries.value = markRaw([
        { name: 'X', color: '#FF9800', data: makeData(gx) },
        { name: 'Y', color: '#9C27B0', data: makeData(gy) },
        { name: 'Z', color: '#00BCD4', data: makeData(gz) },
    ]);
}, 500);

const startTime = computed(() => {
    if (properties.messages.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return properties.messages[0].logTime;
});

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
