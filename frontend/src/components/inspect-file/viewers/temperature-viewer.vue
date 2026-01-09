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

const duration = computed(() => {
    if (properties.messages.length < 2) return 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const end = properties.messages.at(-1).logTime;
    return (end - startTime.value) / 1_000_000_000;
});

const temperatureSeries = shallowRef<ChartSeries[]>([]);

watch(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    () => properties.messages,
    () => {
        const data = [];
        for (const message of properties.messages) {
            if (!message) continue;
            data.push({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                time: (message.logTime - startTime.value) / 1_000_000_000,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
