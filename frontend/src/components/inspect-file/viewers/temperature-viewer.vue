<template>
    <div class="temperature-viewer">
        <div class="bg-white rounded-borders border-color q-pa-md">
            <div class="row justify-between items-center q-mb-md">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="grey-3" text-color="black">
                        <q-icon
                            name="sym_o_schedule"
                            size="xs"
                            class="q-mr-xs"
                        />
                        {{ duration.toFixed(2) }}s
                    </q-badge>
                    <q-badge color="orange-1" text-color="orange-9">
                        {{ messages.length }} Messages
                    </q-badge>
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

            <div v-if="isLoading">
                <SkeletonTimeChart
                    title="Temperature (°C)"
                    :current="messages.length"
                    :total="totalCount"
                />
            </div>
            <div v-else>
                <SimpleTimeChart
                    title="Temperature (°C)"
                    :series="temperatureSeries"
                    :start-time="startTime"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { computed, markRaw, onMounted, shallowRef, watch } from 'vue';
import { useViewer, type BaseMessage } from './common/use-viewer';
import SimpleTimeChart, { type ChartSeries } from './simple-time-chart.vue';
import SkeletonTimeChart from './skeleton-time-chart.vue';

interface TemperatureMessage extends BaseMessage {
    data: {
        temperature?: number;
    };
}

const properties = defineProps<{
    messages: TemperatureMessage[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);

onMounted(() => {
    if (properties.messages.length === 0) {
        emit('load-required');
    }
});

const { startTime, getNormalizedTime, duration } = useViewer(
    properties.messages,
);

const temperatureSeries = shallowRef<ChartSeries[]>([]);

watch(
    () => properties.messages,
    () => {
        const data = [];
        for (const message of properties.messages) {
            data.push({
                time: getNormalizedTime(message.logTime),
                value: message.data.temperature ?? 0,
            });
        }

        temperatureSeries.value = markRaw([
            { name: 'Temp', color: '#F57C00', data },
        ]);
    },
    { immediate: true },
);

async function copyRaw(): Promise<void> {
    await quasarCopy(JSON.stringify(properties.messages, null, 2));
    Notify.create({
        message: 'Data copied',
        color: 'positive',
        timeout: 1000,
    });
}

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);
</script>

<style scoped>
.border-color {
    border: 1px solid #e0e0e0;
}
</style>
