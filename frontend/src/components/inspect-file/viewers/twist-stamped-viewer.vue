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

// --- Data Processing ---
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
const startTime = computed(() => properties.messages[0]?.logTime ?? 0n);

// Helper to extract series data
const extractSeries = (category: 'linear' | 'angular'): ChartSeries[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xData: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yData: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zData: any[] = [];

    for (const message of properties.messages) {
        // Normalized Time
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const t = Number(message.logTime - startTime.value) / 1_000_000_000;
        // Handle TwistStamped vs Twist
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const twist = message.data.twist ?? message.data;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const vec = twist[category];

        if (vec) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            xData.push({ time: t, value: vec.x ?? 0 });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            yData.push({ time: t, value: vec.y ?? 0 });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            zData.push({ time: t, value: vec.z ?? 0 });
        }
    }

    return [
        { name: 'X', color: 'red', data: xData },
        { name: 'Y', color: 'green', data: yData },
        { name: 'Z', color: 'blue', data: zData },
    ];
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
const linearSeries = computed(() => extractSeries('linear'));
// eslint-disable-next-line @typescript-eslint/no-unsafe-return
const angularSeries = computed(() => extractSeries('angular'));

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);
</script>

<style scoped>
/* No styles needed */
</style>
