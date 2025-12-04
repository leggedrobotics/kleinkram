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
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);

const duration = computed(() => {
    if (properties.messages.length < 2) return 0;
    const start = properties.messages[0].logTime;
    const end = properties.messages.at(-1).logTime;
    return Number(end - start) / 1_000_000_000;
});

const accelSeries = shallowRef<ChartSeries[]>([]);
const gyroSeries = shallowRef<ChartSeries[]>([]);

const updateCharts = debounce(() => {
    if (properties.messages.length === 0) {
        accelSeries.value = [];
        gyroSeries.value = [];
        return;
    }

    const startTime = properties.messages[0].logTime;
    const length_ = properties.messages.length;

    const t = new Float32Array(length_);
    const ax = new Float32Array(length_);
    const ay = new Float32Array(length_);
    const az = new Float32Array(length_);
    const gx = new Float32Array(length_);
    const gy = new Float32Array(length_);
    const gz = new Float32Array(length_);

    for (let index = 0; index < length_; index++) {
        const message = properties.messages[index];
        t[index] = Number(message.logTime - startTime) / 1_000_000_000;

        const accumulator = message.data.linear_acceleration || {};
        ax[index] = accumulator.x || 0;
        ay[index] = accumulator.y || 0;
        az[index] = accumulator.z || 0;

        const ang = message.data.angular_velocity || {};
        gx[index] = ang.x || 0;
        gy[index] = ang.y || 0;
        gz[index] = ang.z || 0;
    }

    const makeData = (values: Float32Array) => {
        const result: any[] = Array.from({ length: length_ });
        for (let index = 0; index < length_; index++) {
            result[index] = { time: t[index], value: values[index] };
        }
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
    return properties.messages[0].logTime;
});

watch(() => properties.messages.length, updateCharts, { immediate: true });

async function copyRaw(): Promise<void> {
    if (properties.messages.length === 0) return;
    const last = properties.messages.at(-1);
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
