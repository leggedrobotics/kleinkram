<template>
    <q-card style="background-color: white" class="flex dashboard-card" flat>
        <q-card-section style="width: 100%">
            <v-chart
                :option="option"
                style="width: 100%; height: 100%"
                autoresize
            />
        </q-card-section>
    </q-card>
</template>

<script setup lang="ts">
import VChart from 'vue-echarts';
import { computed } from 'vue';

import { use } from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import {
    GraphicComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
    formatGenericNumber,
    formatSize,
} from 'src/services/general-formatting';
import { useStorageOverview } from 'src/hooks/query-hooks';

use([
    TitleComponent,
    PieChart,
    TooltipComponent,
    GraphicComponent,
    BarChart,
    CanvasRenderer,
    LegendComponent,
]);

const { data: storage } = useStorageOverview();

const usedBytes = computed(() => storage.value?.usedBytes || 0);
const totalBytes = computed(() => storage.value?.totalBytes || 0);
const freeBytes = computed(() => totalBytes.value - usedBytes.value);
const usedInodes = computed(() => storage.value?.usedInodes || 0);
const totalInodes = computed(() => storage.value?.totalInodes || 0);
const freeInodes = computed(() => totalInodes.value - usedInodes.value);

const option = computed(() => {
    return {
        title: {
            text: 'Storage',
            left: 'left',
            fontWeight: 'normal',
            fontSize: 16,
        },
        tooltip: {
            trigger: 'item',
            formatter: (parameters: any) => {
                return `${parameters.name}: ${parameters.data.formatted}`;
            },
        },
        legend: {
            show: true,
            data: ['Storage', 'Inodes'],
            bottom: 0,
            left: 0,
        },
        series: [
            {
                type: 'pie',
                radius: ['75%', '80%'],
                label: {
                    show: false,
                },
                data: [
                    {
                        name: 'Storage',
                        value: usedBytes.value,
                        formatted: formatSize(usedBytes.value),
                        itemStyle: {
                            color: '#0F62FE',
                        },
                    },
                    {
                        name: 'Free Storage',
                        value: freeBytes.value,
                        formatted: formatSize(freeBytes.value),
                        itemStyle: {
                            color: '#eee', // Default color for free space
                        },
                    },
                ],
            },
            {
                type: 'pie',
                radius: ['65%', '70%'],
                label: {
                    show: false,
                },
                data: [
                    {
                        name: 'Inodes',
                        value: usedInodes.value,
                        formatted: formatGenericNumber(usedInodes.value),
                        itemStyle: {
                            color: '#8A3FFC',
                        },
                    },
                    {
                        name: 'Free Inodes',
                        value: freeInodes.value,
                        formatted: formatGenericNumber(freeInodes.value),
                        itemStyle: {
                            color: '#eee', // Default color for free inodes
                        },
                    },
                ],
            },
        ],
        graphic: {
            type: 'text',
            left: 'center',
            top: 'center',
            style: {
                text: `{top|${formatSize(usedBytes.value, 1000, 1)}}\n{bottom|/ ${formatSize(totalBytes.value, 1000, 1)}}`,
                textAlign: 'center',
                rich: {
                    top: {
                        fontSize: 32,
                        fill: '#000', // Text color for the top line
                        font: 'Arial',
                    },
                    bottom: {
                        fontSize: 16,
                        fontWeight: 'normal',
                        fill: '#000', // Text color for the bottom line
                    },
                },
            },
        },
    };
});
</script>
<style scoped></style>
