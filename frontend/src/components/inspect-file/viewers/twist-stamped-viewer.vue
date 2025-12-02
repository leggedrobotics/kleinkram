<template>
    <div class="twist-viewer">
        <ViewerLayout :messages="messages" :total-count="totalCount">
            <div v-if="isLoading" class="q-gutter-y-md">
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
            <div v-else class="q-gutter-y-md">
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
import ViewerLayout from './common/viewer-layout.vue';
import SimpleTimeChart, { type ChartSeries } from './simple-time-chart.vue';
import SkeletonTimeChart from './skeleton-time-chart.vue';

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

// --- Data Processing ---
const startTime = computed(() => properties.messages[0]?.logTime || 0n);

// Helper to extract series data
const extractSeries = (category: 'linear' | 'angular'): ChartSeries[] => {
    const xData: any[] = [];
    const yData: any[] = [];
    const zData: any[] = [];

    for (const message of properties.messages) {
        // Normalized Time
        const t = Number(message.logTime - startTime.value) / 1_000_000_000;
        // Handle TwistStamped vs Twist
        const twist = message.data.twist || message.data;
        const vec = twist[category];

        if (vec) {
            xData.push({ time: t, value: vec.x || 0 });
            yData.push({ time: t, value: vec.y || 0 });
            zData.push({ time: t, value: vec.z || 0 });
        }
    }

    return [
        { name: 'X', color: 'red', data: xData },
        { name: 'Y', color: 'green', data: yData },
        { name: 'Z', color: 'blue', data: zData },
    ];
};

const linearSeries = computed(() => extractSeries('linear'));
const angularSeries = computed(() => extractSeries('angular'));

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);
</script>

<style scoped>
/* No styles needed */
</style>
