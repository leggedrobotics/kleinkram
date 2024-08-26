<template>
    <q-card style="height: 500px; width: 500px" class="flex">
        <q-card-section style="width: 500px">
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
import { computed, ref, watch } from 'vue';

import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import {
    TitleComponent,
    PolarComponent,
    TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useQuery } from '@tanstack/vue-query';
import { getStorage } from 'src/services/queries/file';
import {
    formatGenericNumber,
    formatSize,
} from 'src/services/generalFormatting';

use([
    TitleComponent,
    PolarComponent,
    TooltipComponent,
    BarChart,
    CanvasRenderer,
]);

const { data: storage } = useQuery<StorageResponse>({
    queryFn: () => getStorage(),
    queryKey: ['storage'],
});
// const bytePercentage = computed(() => {
//     if (storage.value) {
//         return Math.round(
//             (storage.value.usedBytes / storage.value.totalBytes) * 100,
//         );
//     }
//     return 0;
// });
const bytePercentage = ref(30);
const inodePercentage = computed(() => {
    if (storage.value) {
        return Math.round(
            (storage.value.usedInodes / storage.value.totalInodes) * 100,
        );
    }
    return 0;
});

const option = computed(() => {
    return {
        title: [
            {
                text: 'Storage utilization',
                left: 'center',
            },
        ],
        polar: {
            radius: ['40px', '80%'],
        },
        angleAxis: {
            max: 100,
            startAngle: 90,
        },
        radiusAxis: {
            type: 'category',
            data: ['data', 'inodes'],
        },
        tooltip: {
            trigger: 'item',
            formatter: (params) => {
                return `${params.data.used} / ${params.data.total}`;
            },
        },
        series: {
            type: 'bar',
            data: [
                {
                    value: bytePercentage.value,
                    used: formatSize(storage.value?.usedBytes || 0),
                    total: formatSize(storage.value?.totalBytes || 0),
                    itemStyle: {
                        color: interpolateColor(bytePercentage.value, 0, 100),
                    },
                },
                {
                    value: inodePercentage.value,
                    used: formatGenericNumber(storage.value?.usedInodes || 0),
                    total: formatGenericNumber(storage.value?.totalInodes || 0),
                    itemStyle: {
                        color: interpolateColor(inodePercentage.value, 0, 100),
                    },
                },
            ],
            coordinateSystem: 'polar',
            label: {
                show: false,
            },
        },
    };
});

function interpolateColor(
    value: number,
    minValue: number,
    maxValue: number,
): string {
    const startColor = { r: 0, g: 255, b: 0 }; // Green
    const midColor = { r: 255, g: 255, b: 0 }; // Yellow
    const endColor = { r: 255, g: 0, b: 0 }; // Red

    const midValue = (minValue + maxValue) / 2;

    let r, g, b;

    if (value <= midValue) {
        // Transition from green to yellow
        const ratio = (value - minValue) / (midValue - minValue);
        r = Math.round(startColor.r + ratio * (midColor.r - startColor.r));
        g = Math.round(startColor.g + ratio * (midColor.g - startColor.g));
        b = Math.round(startColor.b + ratio * (midColor.b - startColor.b));
    } else {
        // Transition from yellow to red
        const ratio = (value - midValue) / (maxValue - midValue);
        r = Math.round(midColor.r + ratio * (endColor.r - midColor.r));
        g = Math.round(midColor.g + ratio * (endColor.g - midColor.g));
        b = Math.round(midColor.b + ratio * (endColor.b - midColor.b));
    }

    return `rgb(${r},${g},${b})`;
}
</script>
<style scoped></style>
