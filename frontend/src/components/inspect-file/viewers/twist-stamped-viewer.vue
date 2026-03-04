<template>
    <div class="twist-viewer">
        <ViewerLayout :messages="messages" :total-count="totalCount">
            <div v-if="isLoading" key="loading" class="q-gutter-y-md">
                <SkeletonTimeChart
                    title="Linear Velocity (m/s)"
                    :current="messages.length"
                    :total="totalCount"
                />
                <SkeletonTimeChart
                    title="Angular Velocity (rad/s)"
                    :current="messages.length"
                    :total="totalCount"
                />
            </div>
            <div v-else key="loaded" class="q-gutter-y-md">
                <SimpleTimeChart
                    title="Linear Velocity (m/s)"
                    :series="linearSeries"
                    :start-time="startTime"
                />
                <SimpleTimeChart
                    title="Angular Velocity (rad/s)"
                    :series="angularSeries"
                    :start-time="startTime"
                />
            </div>
        </ViewerLayout>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useViewer, type BaseMessage } from './common/use-viewer';
import ViewerLayout from './common/viewer-layout.vue';
import SimpleTimeChart, { type ChartSeries } from './simple-time-chart.vue';
import SkeletonTimeChart from './skeleton-time-chart.vue';

interface Vector3 {
    x?: number;
    y?: number;
    z?: number;
}

interface TwistMessage extends BaseMessage {
    data: {
        twist?: {
            linear?: Vector3;
            angular?: Vector3;
        };
        linear?: Vector3;
        angular?: Vector3;
    };
}

const properties = defineProps<{
    messages: TwistMessage[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);

onMounted(() => {
    if (properties.messages.length === 0) emit('load-required');
});

const { startTime, getNormalizedTime } = useViewer(() => properties.messages);

const extractSeries = (category: 'linear' | 'angular'): ChartSeries[] => {
    const xData: { time: number; value: number }[] = [];
    const yData: { time: number; value: number }[] = [];
    const zData: { time: number; value: number }[] = [];

    for (const message of properties.messages) {
        const t = getNormalizedTime(message.logTime);

        // Handle TwistStamped vs Twist
        const twist = message.data.twist ?? message.data;
        const vec = twist[category];

        if (vec) {
            xData.push({ time: t, value: vec.x ?? 0 });
            yData.push({ time: t, value: vec.y ?? 0 });
            zData.push({ time: t, value: vec.z ?? 0 });
        }
    }

    return [
        { name: 'X', color: 'red', data: xData },
        { name: 'Y', color: 'green', data: yData },
        { name: 'Z', color: 'blue', data: zData },
    ];
};

const linearSeries = computed<ChartSeries[]>((): ChartSeries[] =>
    extractSeries('linear'),
);
const angularSeries = computed<ChartSeries[]>((): ChartSeries[] =>
    extractSeries('angular'),
);

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);
</script>

<style scoped>
/* No styles needed */
</style>
