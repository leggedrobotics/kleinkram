<template>
    <div :class="$q.screen.xs ? 'q-py-md' : 'q-pa-md'">
        <p class="help-text q-mb-lg" style="max-width: 650px">
            While an action runs we sample the CPU and memory usage of its
            container about once per second. The values below compare those
            samples against the limits configured on the action template.
        </p>

        <div class="row q-col-gutter-md">
            <div
                v-for="stat in stats"
                :key="stat.label"
                class="col-12 col-md-4"
            >
                <div class="metric-tile">
                    <div class="metric-tile__header">
                        <q-icon
                            :name="stat.icon"
                            size="18px"
                            class="text-icon-secondary"
                        />
                        <span class="metric-tile__label">{{ stat.label }}</span>
                        <q-icon
                            name="sym_o_help"
                            size="16px"
                            class="metric-tile__help"
                        >
                            <q-tooltip>{{ stat.hint }}</q-tooltip>
                        </q-icon>
                    </div>

                    <div class="metric-tile__value">
                        <span class="metric-tile__number">{{
                            stat.value
                        }}</span>
                        <span class="metric-tile__unit">{{ stat.unit }}</span>
                        <span class="metric-tile__limit"
                            >of {{ stat.limit }}</span
                        >
                    </div>

                    <div
                        class="metric-tile__meter"
                        role="progressbar"
                        :aria-label="stat.label"
                        :aria-valuenow="Math.round(stat.ratio * 100)"
                        aria-valuemin="0"
                        aria-valuemax="100"
                    >
                        <div
                            class="metric-tile__meter-fill"
                            :style="{
                                width: `${Math.min(stat.ratio, 1) * 100}%`,
                                backgroundColor: statusColor(stat.ratio),
                            }"
                        />
                    </div>

                    <div
                        class="metric-tile__status"
                        :style="{ color: statusTextColor(stat.ratio) }"
                    >
                        <span
                            class="metric-tile__dot"
                            :style="{
                                backgroundColor: statusColor(stat.ratio),
                            }"
                        />
                        {{ formatPercent(stat.ratio * 100) }} of limit ·
                        {{ statusLabel(stat.ratio) }}
                    </div>
                </div>
            </div>
        </div>

        <div class="section-heading">
            <h2 class="text-h5 q-ma-none text-grey-9">Usage Over Time</h2>
            <span v-if="hasSamples" class="help-text">
                {{ samples.length }} samples over {{ formatDuration(duration) }}
            </span>
        </div>

        <div v-if="hasSamples" class="row q-col-gutter-md">
            <div
                v-for="chart in charts"
                :key="chart.title"
                class="col-12 col-md-6"
            >
                <div class="chart-panel">
                    <div class="chart-panel__header">
                        <span
                            class="chart-panel__swatch"
                            :style="{ backgroundColor: chart.color }"
                        />
                        <span class="chart-panel__title">{{
                            chart.title
                        }}</span>
                        <span class="chart-panel__meta">{{ chart.meta }}</span>
                    </div>
                    <v-chart
                        class="chart"
                        :option="chart.option"
                        :aria-label="chart.title"
                        autoresize
                    />
                </div>
            </div>
        </div>

        <div v-else class="chart-panel chart-panel--empty">
            <q-icon
                name="sym_o_monitoring"
                size="32px"
                class="text-icon-secondary q-mb-sm"
            />
            <div class="text-body2">No samples were recorded</div>
            <div class="help-text q-mt-xs" style="max-width: 420px">
                The action finished before the first sample was taken, so there
                is no usage curve to show.
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
    MarkLineComponent,
    TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { format } from 'quasar';
import { computed } from 'vue';
import VChart from 'vue-echarts';

interface TooltipParameter {
    marker: string;
    seriesName: string;
    value: [number, number];
}

const { humanStorageSize } = format;

use([
    CanvasRenderer,
    LineChart,
    GridComponent,
    TooltipComponent,
    MarkLineComponent,
]);

// Design tokens (see src/css/quasar.variables.sass). ECharts needs literal
// colors, so the ones used inside chart options are repeated here.
const BORDER_SUBTLE = '#e0e0e0';
const TEXT_SECONDARY = '#525252';
const TEXT_PRIMARY = '#161616';
const SUPPORT_SUCCESS = '#24a148';
const SUPPORT_WARNING = '#f1c21b';
const SUPPORT_ERROR = '#da1e28';
// Same two series colors as the storage chart on the dashboard.
const MEMORY_COLOR = '#0f62fe';
const CPU_COLOR = '#8a3ffc';

const props = defineProps<{
    action: ActionDto;
}>();

const resourceUsage = computed<ResourceUsage | undefined>(
    () => props.action.resourceUsage,
);

const samples = computed(() => resourceUsage.value?.samples ?? []);
const hasSamples = computed(() => samples.value.length > 0);
const duration = computed(() => samples.value.at(-1)?.t ?? 0);

const memoryLimitBytes = computed(
    () => (props.action.template.cpuMemory || 2) * 1024 * 1024 * 1024,
);

const cpuCoresLimit = computed(() => props.action.template.cpuCores || 1);
const cpuLimitPercent = computed(() => cpuCoresLimit.value * 100);

/**
 * `humanStorageSize` returns value and unit in one string ("3.2GB"); the tiles
 * render them at different sizes, so they are split apart here.
 */
const splitStorageSize = (bytes: number): [string, string] => {
    const formatted = humanStorageSize(bytes);
    const match = /^([\d.]+)\s*(\D+)$/.exec(formatted);
    return match?.[1] && match[2] ? [match[1], match[2]] : [formatted, ''];
};

const formatPercent = (percent: number) => `${percent.toFixed(1)}%`;

const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    return minutes > 0
        ? `${String(minutes)}:${String(rest).padStart(2, '0')} min`
        : `${String(rest)}s`;
};

const formatCores = (percent: number) => (percent / 100).toFixed(2);

const ratio = (value: number, limit: number) => (limit > 0 ? value / limit : 0);

const statusColor = (value: number) => {
    if (value >= 1) return SUPPORT_ERROR;
    if (value >= 0.8) return SUPPORT_WARNING;
    return SUPPORT_SUCCESS;
};

// Amber on white is too faint to read, so only the critical state colors the
// text; the dot and the meter carry the status everywhere else.
const statusTextColor = (value: number) =>
    value >= 1 ? SUPPORT_ERROR : TEXT_SECONDARY;

const statusLabel = (value: number) => {
    if (value >= 1) return 'at the limit';
    if (value >= 0.8) return 'close to the limit';
    return 'within the limit';
};

const stats = computed(() => {
    const usage = resourceUsage.value;
    const [maxMemoryValue, maxMemoryUnit] = splitStorageSize(
        usage?.maxMemoryBytes ?? 0,
    );
    const [limitValue, limitUnit] = splitStorageSize(memoryLimitBytes.value);
    const cores = `${String(cpuCoresLimit.value)} core${cpuCoresLimit.value > 1 ? 's' : ''}`;

    return [
        {
            label: 'Maximum Memory',
            icon: 'sym_o_memory',
            value: maxMemoryValue,
            unit: maxMemoryUnit,
            limit: `${limitValue} ${limitUnit}`,
            ratio: ratio(usage?.maxMemoryBytes ?? 0, memoryLimitBytes.value),
            hint: 'Highest memory usage measured in the action container. Exceeding the limit terminates the container.',
        },
        {
            label: 'Average CPU',
            icon: 'sym_o_speed',
            value: formatCores(usage?.avgCpuPercent ?? 0),
            unit: 'cores',
            limit: cores,
            ratio: ratio(usage?.avgCpuPercent ?? 0, cpuLimitPercent.value),
            hint: 'Mean CPU usage across all samples in which the container used the CPU. A low value means the action is not using the cores it reserved.',
        },
        {
            label: 'Maximum CPU',
            icon: 'sym_o_bolt',
            value: formatCores(usage?.maxCpuPercent ?? 0),
            unit: 'cores',
            limit: cores,
            ratio: ratio(usage?.maxCpuPercent ?? 0, cpuLimitPercent.value),
            hint: 'Highest CPU usage measured in the action container, summed over all cores.',
        },
    ];
});

const baseChartOption = (
    color: string,
    name: string,
    data: [number, number][],
    limit: number,
    limitLabel: string,
    formatValue: (value: number) => string,
    axisUnit: string,
    formatAxisValue: (value: number) => string,
) => {
    // Gridlines are placed at quarters of the limit, and the axis only grows
    // past the limit in whole steps. That keeps the labels on round values and
    // makes the limit line land on a gridline even when the action went over.
    const step = limit / 4;
    const dataMax = Math.max(0, ...data.map(([, value]) => value));
    const axisMax = Math.max(limit, Math.ceil(dataMax / step) * step);

    return {
        grid: { top: 16, left: 4, right: 12, bottom: 4, containLabel: true },
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#ffffff',
            borderColor: BORDER_SUBTLE,
            borderWidth: 1,
            padding: [6, 10],
            textStyle: { color: TEXT_PRIMARY, fontSize: 12 },
            extraCssText:
                'border-radius: 4px; box-shadow: 0 2px 6px #16161614;',
            axisPointer: {
                type: 'line',
                lineStyle: { color: '#8d8d8d', type: 'dashed' },
            },
            formatter: (parameters: unknown) => {
                const list = (
                    Array.isArray(parameters) ? parameters : [parameters]
                ) as TooltipParameter[];
                const point = list[0];
                if (!point) return '';
                return `${formatDuration(point.value[0])}<br/>${point.marker} ${
                    point.seriesName
                }: ${formatValue(point.value[1])}`;
            },
        },
        xAxis: {
            type: 'value',
            min: 0,
            max: Math.max(duration.value, 1),
            axisLine: { lineStyle: { color: BORDER_SUBTLE } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: {
                color: TEXT_SECONDARY,
                fontSize: 11,
                formatter: (value: number) => formatDuration(value),
            },
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: axisMax,
            interval: step,
            name: axisUnit,
            nameTextStyle: {
                color: TEXT_SECONDARY,
                fontSize: 11,
                align: 'left',
            },
            nameGap: 8,
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: BORDER_SUBTLE, type: 'dashed' } },
            axisLabel: {
                color: TEXT_SECONDARY,
                fontSize: 11,
                formatter: (value: number) => formatAxisValue(value),
            },
        },
        series: [
            {
                name,
                type: 'line',
                data,
                smooth: 0.25,
                showSymbol: false,
                lineStyle: { width: 2, color },
                itemStyle: { color },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                            { offset: 0, color: `${color}33` },
                            { offset: 1, color: `${color}00` },
                        ],
                    },
                },
                markLine: {
                    silent: true,
                    symbol: 'none',
                    lineStyle: { color: '#8d8d8d', type: 'dashed', width: 1 },
                    label: {
                        formatter: limitLabel,
                        color: TEXT_SECONDARY,
                        fontSize: 11,
                        position: 'insideEndTop',
                        // The label sits on top of the curve, so it needs a
                        // background to stay readable.
                        backgroundColor: '#ffffff',
                        padding: [2, 4],
                    },
                    data: [{ yAxis: limit }],
                },
            },
        ],
    };
};

const charts = computed(() => {
    const [memoryLimitValue, memoryLimitUnit] = splitStorageSize(
        memoryLimitBytes.value,
    );
    const memoryLimitValueNumber = Number(memoryLimitValue);
    const [peakValue, peakUnit] = splitStorageSize(
        resourceUsage.value?.maxMemoryBytes ?? 0,
    );

    // The memory axis is scaled to the limit, so every gridline shares the
    // unit of the limit and only the number has to be drawn on the axis.
    const formatMemoryAxisValue = (value: number) => {
        const scaled =
            (value / memoryLimitBytes.value) * memoryLimitValueNumber;
        return scaled < 0.05 ? '0' : scaled.toFixed(1);
    };

    return [
        {
            title: 'Memory',
            color: MEMORY_COLOR,
            meta: `peak ${peakValue} ${peakUnit} · limit ${memoryLimitValue} ${memoryLimitUnit}`,
            option: baseChartOption(
                MEMORY_COLOR,
                'Memory',
                samples.value.map((s): [number, number] => [s.t, s.m]),
                memoryLimitBytes.value,
                `Limit ${memoryLimitValue} ${memoryLimitUnit}`,
                (value: number) => humanStorageSize(value),
                memoryLimitUnit,
                formatMemoryAxisValue,
            ),
        },
        {
            title: 'CPU',
            color: CPU_COLOR,
            meta: `peak ${formatCores(resourceUsage.value?.maxCpuPercent ?? 0)} · limit ${String(cpuCoresLimit.value)} core${cpuCoresLimit.value > 1 ? 's' : ''}`,
            option: baseChartOption(
                CPU_COLOR,
                'CPU',
                samples.value.map((s): [number, number] => [s.t, s.c]),
                cpuLimitPercent.value,
                `Limit ${String(cpuCoresLimit.value)} core${cpuCoresLimit.value > 1 ? 's' : ''}`,
                (value: number) => `${formatCores(value)} cores`,
                'cores',
                (value: number) => (value / 100).toFixed(1),
            ),
        },
    ];
});
</script>

<style scoped>
/*
 * The app renders surfaces flat and bordered (tables, log output, inputs), so
 * the tiles and chart panels use the same 1px $border-subtle-00 frame instead
 * of Quasar's elevated cards.
 */
.section-heading {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 12px;
    margin: 40px 0 8px;
}

.metric-tile,
.chart-panel {
    background-color: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}

.metric-tile {
    height: 100%;
    padding: 16px;
}

.metric-tile__header {
    display: flex;
    align-items: center;
    gap: 6px;
}

.metric-tile__label {
    color: #525252;
    font-size: 12px;
    line-height: 16px;
}

.metric-tile__help {
    color: #a8a8a8;
    cursor: help;
}

.metric-tile__value {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 12px;
}

.metric-tile__number {
    color: #161616;
    font-size: 32px;
    line-height: 36px;
    font-weight: 400;
}

.metric-tile__unit {
    color: #161616;
    font-size: 16px;
}

.metric-tile__limit {
    color: #525252;
    font-size: 12px;
    margin-left: 4px;
}

.metric-tile__meter {
    margin-top: 12px;
    height: 4px;
    border-radius: 2px;
    background-color: #e0e0e0;
    overflow: hidden;
}

.metric-tile__meter-fill {
    height: 100%;
    transition: width 0.3s ease;
}

.metric-tile__status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    line-height: 16px;
}

.metric-tile__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: 0 0 auto;
}

.chart-panel {
    padding: 16px;
}

.chart-panel__header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.chart-panel__swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
}

.chart-panel__title {
    color: #161616;
    font-size: 14px;
    font-weight: 500;
}

.chart-panel__meta {
    color: #525252;
    font-size: 12px;
}

.chart-panel--empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 48px 16px;
    color: #525252;
}

.chart {
    height: 260px;
    width: 100%;
    margin-top: 8px;
}

/* Charts are unreadable when they keep their desktop height on a phone */
@media (max-width: 599px) {
    .chart {
        height: 200px;
    }
}
</style>
