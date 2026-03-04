<template>
    <div class="q-pa-md">
        <div class="row q-col-gutter-md">
            <!-- Summary Cards -->
            <div class="col-12 col-md-4">
                <q-card class="my-card overflow-hidden">
                    <q-card-section>
                        <div class="text-subtitle2 grey-text">
                            Maximum Memory
                        </div>
                        <div class="row items-center no-wrap">
                            <div class="text-h4 text-primary q-mr-sm">
                                {{ formatBytes(resourceUsage?.maxMemoryBytes) }}
                            </div>
                            <div class="text-caption text-grey">
                                / {{ formatBytes(memoryLimitBytes) }}
                            </div>
                        </div>
                        <div class="text-caption text-primary">
                            {{ formatPercent(memoryProgress * 100) }}
                        </div>
                        <q-linear-progress
                            :value="memoryProgress"
                            :color="getStatusColor(memoryProgress)"
                            class="q-mt-xs"
                            rounded
                            size="8px"
                        />
                    </q-card-section>
                </q-card>
            </div>
            <div class="col-12 col-md-4">
                <q-card class="my-card overflow-hidden">
                    <q-card-section>
                        <div class="text-subtitle2 grey-text">Average CPU</div>
                        <div class="row items-center no-wrap">
                            <div class="text-h4 text-secondary q-mr-sm">
                                {{
                                    formatCpuAbsolute(
                                        resourceUsage?.avgCpuPercent,
                                    )
                                }}
                            </div>
                            <div class="text-caption text-grey">
                                / {{ cpuCoresLimit }} Core{{
                                    cpuCoresLimit > 1 ? 's' : ''
                                }}
                            </div>
                        </div>
                        <div class="text-caption text-secondary">
                            {{ formatPercent(resourceUsage?.avgCpuPercent) }}
                        </div>
                        <q-linear-progress
                            :value="avgCpuProgress"
                            :color="getStatusColor(avgCpuProgress)"
                            class="q-mt-xs"
                            rounded
                            size="8px"
                        />
                    </q-card-section>
                </q-card>
            </div>
            <div class="col-12 col-md-4">
                <q-card class="my-card overflow-hidden">
                    <q-card-section>
                        <div class="text-subtitle2 grey-text">Maximum CPU</div>
                        <div class="row items-center no-wrap">
                            <div class="text-h4 text-secondary q-mr-sm">
                                {{
                                    formatCpuAbsolute(
                                        resourceUsage?.maxCpuPercent,
                                    )
                                }}
                            </div>
                            <div class="text-caption text-grey">
                                / {{ cpuCoresLimit }} Core{{
                                    cpuCoresLimit > 1 ? 's' : ''
                                }}
                            </div>
                        </div>
                        <div class="text-caption text-secondary">
                            {{ formatPercent(resourceUsage?.maxCpuPercent) }}
                        </div>
                        <q-linear-progress
                            :value="maxCpuProgress"
                            :color="getStatusColor(maxCpuProgress)"
                            class="q-mt-xs"
                            rounded
                            size="8px"
                        />
                    </q-card-section>
                </q-card>
            </div>

            <!-- Charts -->
            <div class="col-12">
                <q-card class="q-mt-md">
                    <q-card-section>
                        <div class="text-h6">Resource Usage Over Time</div>
                    </q-card-section>
                    <q-card-section class="row">
                        <div class="col-12 col-md-6 q-pa-sm">
                            <v-chart
                                class="chart"
                                :option="memoryChartOption"
                                autoresize
                            />
                        </div>
                        <div class="col-12 col-md-6 q-pa-sm">
                            <v-chart
                                class="chart"
                                :option="cpuChartOption"
                                autoresize
                            />
                        </div>
                    </q-card-section>
                </q-card>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ActionDto } from '@kleinkram/api-dto';
import { ResourceUsage } from '@kleinkram/shared';
// @ts-ignore
import { LineChart } from 'echarts/charts';
import {
    GridComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { format } from 'quasar';
import { computed } from 'vue';
import VChart from 'vue-echarts';

interface TooltipParameter {
    name: string;
    marker: string;
    seriesName: string;
    value: number;
}

const { humanStorageSize } = format;

use([
    CanvasRenderer,
    LineChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
]);

const props = defineProps<{
    action: ActionDto;
}>();

const resourceUsage = computed<ResourceUsage | undefined>(() => {
    return props.action.resourceUsage;
});

const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return '-';
    return humanStorageSize(bytes);
};

const formatPercent = (percent?: number) => {
    if (percent === undefined) return '-';
    return `${percent.toFixed(1)}%`;
};

const formatCpuAbsolute = (percent?: number) => {
    if (percent === undefined) return '-';
    return (percent / 100).toFixed(2);
};

const memoryLimitBytes = computed(() => {
    return (props.action.template.cpuMemory || 2) * 1024 * 1024 * 1024;
});

const cpuCoresLimit = computed(() => {
    return props.action.template.cpuCores || 1;
});

const memoryProgress = computed(() => {
    if (!resourceUsage.value?.maxMemoryBytes) return 0;
    return Math.min(
        resourceUsage.value.maxMemoryBytes / memoryLimitBytes.value,
        1,
    );
});

const avgCpuProgress = computed(() => {
    if (!resourceUsage.value?.avgCpuPercent) return 0;
    return Math.min(
        resourceUsage.value.avgCpuPercent / (cpuCoresLimit.value * 100),
        1.2,
    );
});

const maxCpuProgress = computed(() => {
    if (!resourceUsage.value?.maxCpuPercent) return 0;
    return Math.min(
        resourceUsage.value.maxCpuPercent / (cpuCoresLimit.value * 100),
        1.2,
    );
});

const getStatusColor = (progress: number) => {
    if (progress > 1) return 'red';
    if (progress > 0.8) return 'amber';
    return 'green';
};

const memoryChartOption = computed(() => {
    const samples = resourceUsage.value?.samples ?? [];
    const limitValue = memoryLimitBytes.value;
    return {
        title: { text: 'Memory Usage' },
        tooltip: {
            trigger: 'axis',
            formatter: (params: unknown) => {
                const list = (
                    Array.isArray(params) ? params : [params]
                ) as TooltipParameter[];
                const p = list[0];
                if (!p) return '';
                return `${p.name}<br/>${p.marker} ${
                    p.seriesName
                }: ${humanStorageSize(p.value)}`;
            },
        },
        xAxis: {
            type: 'category', // Using category for simpler mapping, or 'value' for time
            data: samples.map((s) => `${String(s.t)}s`),
        },
        yAxis: {
            type: 'value',
            max: limitValue,
            min: 0,
            splitNumber: 4,
            axisLabel: {
                formatter: (value: number) => humanStorageSize(value),
            },
        },
        series: [
            {
                data: samples.map((s) => s.m),
                type: 'line',
                smooth: true,
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                            { offset: 0, color: '#1976D288' },
                            { offset: 1, color: '#1976D200' },
                        ],
                    },
                },
                name: 'Memory',
                itemStyle: { color: '#1976D2' }, // Primary Blue
            },
        ],
    };
});

const cpuChartOption = computed(() => {
    const samples = resourceUsage.value?.samples ?? [];
    const limit = cpuCoresLimit.value * 100;
    return {
        title: { text: 'CPU Usage' },
        tooltip: {
            trigger: 'axis',
            formatter: (params: unknown) => {
                const list = (
                    Array.isArray(params) ? params : [params]
                ) as TooltipParameter[];
                const p = list[0];
                if (!p) return '';
                const absValue = (p.value / 100).toFixed(2);
                return `${p.name}<br/>${p.marker} ${p.seriesName}: ${absValue} Cores (${p.value.toFixed(1)}%)`;
            },
        },
        xAxis: {
            type: 'category',
            data: samples.map((s) => `${String(s.t)}s`),
        },
        yAxis: {
            type: 'value',
            max: Math.max(limit, Math.max(...samples.map((s) => s.c), 0)),
            min: 0,
            splitNumber: 5,
            axisLabel: {
                formatter: '{value} %',
            },
        },
        series: [
            {
                data: samples.map((s) => s.c),
                type: 'line',
                smooth: true,
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                            { offset: 0, color: '#26A69A88' },
                            { offset: 1, color: '#26A69A00' },
                        ],
                    },
                },
                name: 'CPU',
                itemStyle: { color: '#26A69A' }, // Secondary Teal
            },
        ],
    };
});
</script>

<style scoped>
.chart {
    height: 300px;
    width: 100%;
}
.my-card {
    height: 100%;
}
</style>
