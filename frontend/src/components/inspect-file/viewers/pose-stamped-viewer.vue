<template>
    <div class="pose-stamped-viewer">
        <ViewerLayout
            :messages="messages"
            :total-count="totalCount"
            :is-loading="isLoading"
        >
            <template #header-extra>
                <q-badge outline color="grey-7"> Frame: {{ frameId }} </q-badge>
            </template>

            <div v-if="isLoading" class="row q-col-gutter-md">
                <div class="col-12">
                    <SkeletonTimeChart
                        title="Position (m)"
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
            </div>
        </ViewerLayout>
    </div>
</template>

<script setup lang="ts">
import { debounce } from 'quasar';
import { computed, markRaw, onMounted, shallowRef, watch } from 'vue';
import ViewerLayout from './common/viewer-layout.vue';
import SimpleTimeChart, { ChartSeries } from './simple-time-chart.vue';
import SkeletonTimeChart from './skeleton-time-chart.vue';

const properties = defineProps<{
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required']);

onMounted(() => {
    if (!properties.messages || properties.messages.length === 0)
        emit('load-required');
});

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);

const startTime = computed(() => {
    if (properties.messages.length === 0) return;
    return properties.messages[0].logTime;
});

const frameId = computed(
    () => properties.messages[0]?.data?.header?.frame_id || '-',
);

const positionSeries = shallowRef<ChartSeries[]>([]);

const updateCharts = debounce(() => {
    if (properties.messages.length === 0) {
        positionSeries.value = [];
        return;
    }

    const logStartTime = properties.messages[0].logTime;
    const length_ = properties.messages.length;

    const t = new Float32Array(length_);
    const px = new Float32Array(length_);
    const py = new Float32Array(length_);
    const pz = new Float32Array(length_);

    for (let index = 0; index < length_; index++) {
        const message = properties.messages[index];
        t[index] = Number(message.logTime - logStartTime) / 1_000_000_000;

        const pos = message.data.pose?.position || {};
        px[index] = pos.x || 0;
        py[index] = pos.y || 0;
        pz[index] = pos.z || 0;
    }

    const makeData = (values: Float32Array) => {
        const result: any[] = Array.from({ length: length_ });
        for (let index = 0; index < length_; index++) {
            result[index] = { time: t[index], value: values[index] };
        }
        return result;
    };

    positionSeries.value = markRaw([
        { name: 'X', color: '#F44336', data: makeData(px) },
        { name: 'Y', color: '#4CAF50', data: makeData(py) },
        { name: 'Z', color: '#2196F3', data: makeData(pz) },
    ]);
}, 500);

watch(() => properties.messages.length, updateCharts, { immediate: true });
</script>

<style scoped>
/* No styles needed */
</style>
