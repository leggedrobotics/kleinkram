<template>
    <div class="statistics-viewer">
        <div class="bg-white rounded-borders border-color q-pa-md">
            <div class="row justify-between items-center q-mb-md">
                <div class="text-subtitle2 text-grey-8">
                    Processing Statistics
                </div>
                <q-badge color="blue-1" text-color="blue-9">
                    {{ messages.length }} Messages
                </q-badge>
            </div>

            <div class="row q-col-gutter-md">
                <!-- Average FPS -->
                <div class="col-12 col-md-4">
                    <q-list dense bordered separator class="rounded-borders">
                        <q-item>
                            <q-item-section>Average FPS</q-item-section>
                            <q-item-section side class="text-weight-bold">
                                {{ averageFps.toFixed(2) }} Hz
                            </q-item-section>
                        </q-item>
                    </q-list>
                </div>

                <!-- Chart -->
                <div
                    class="col-12 col-md-8"
                    style="height: 300px; position: relative"
                >
                    <div v-if="isLoading" class="absolute-full">
                        <SkeletonTimeChart
                            title="Processing FPS"
                            :height="300"
                            :current="messages.length"
                            :total="totalCount"
                        />
                    </div>

                    <SimpleTimeChart
                        v-else
                        :series="fpsSeries"
                        y-axis-label="FPS"
                        :color-palette="['#1976D2']"
                        :start-time="startTime"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, markRaw, shallowRef, watch } from 'vue';
import SimpleTimeChart from './simple-time-chart.vue';
import SkeletonTimeChart from './skeleton-time-chart.vue';

const properties = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const averageFps = computed(() => {
    if (properties.messages.length === 0) return 0;

    let sum = 0;
    let count = 0;

    for (const message of properties.messages) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const fps = message.data?.pointcloud_process_fps;
        if (typeof fps === 'number' && !Number.isNaN(fps)) {
            sum += fps;
            count++;
        }
    }

    return count > 0 ? sum / count : 0;
});

// Show loading until we have all messages (or close to it, e.g. 99%)
// The totalCount might be slightly off due to estimation in some readers,
// but usually exact for ROS bags if indexed.
const isLoading = computed(() => {
    return properties.messages.length < properties.totalCount;
});

const startTime = computed(() => {
    if (properties.messages.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return properties.messages[0].logTime;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fpsSeries = shallowRef<any[]>([]);

watch(
    () => properties.messages.length,
    () => {
        if (properties.messages.length === 0) {
            fpsSeries.value = [];
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const logStartTime = properties.messages[0].logTime;
        const data = properties.messages.map((message) => ({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            time: (message.logTime - logStartTime) / 1_000_000_000,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            value: message.data.pointcloud_process_fps ?? 0,
        }));

        fpsSeries.value = markRaw([
            { name: 'Processing FPS', color: '#1976D2', data },
        ]);
    },
    { immediate: true },
);
</script>

<style scoped>
.border-color {
    border: 1px solid #e0e0e0;
}
</style>
