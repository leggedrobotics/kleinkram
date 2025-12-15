<template>
    <div class="simple-time-chart">
        <div class="row justify-between items-center q-mb-xs">
            <div class="text-subtitle2">{{ title }}</div>
            <div
                v-if="series.length > 0"
                class="text-caption row q-gutter-x-sm"
            >
                <div
                    v-for="s in series"
                    :key="s.name"
                    class="row items-center"
                    :style="{ color: s.color }"
                >
                    <span style="font-size: 14px; margin-right: 2px">•</span>
                    {{ s.name }}
                </div>
            </div>
        </div>

        <div
            ref="graphContainer"
            class="graph-wrapper bg-grey-1 rounded-borders"
            @mousemove="onMouseMove"
            @mouseleave="onMouseLeave"
        >
            <svg
                :viewBox="`0 0 ${width} ${height}`"
                class="chart-svg"
                preserveAspectRatio="none"
            >
                <line
                    v-if="yRange.min < 0 && yRange.max > 0"
                    :x1="0"
                    :y1="getY(0)"
                    :x2="width"
                    :y2="getY(0)"
                    stroke="#ccc"
                    stroke-width="1"
                    stroke-dasharray="4"
                />

                <polyline
                    v-for="s in sampledSeries"
                    :key="s.name"
                    fill="none"
                    :stroke="s.color"
                    stroke-width="1.5"
                    :points="getPoints(s.data)"
                />

                <!-- Cursor Line -->
                <line
                    v-if="hoverX !== null"
                    :x1="hoverX"
                    :y1="0"
                    :x2="hoverX"
                    :y2="height"
                    stroke="#666"
                    stroke-width="1"
                    stroke-dasharray="2"
                />
            </svg>

            <div class="axis-labels">
                <span class="max">{{ fmt(yRange.max) }}</span>
                <span class="min">{{ fmt(yRange.min) }}</span>
            </div>

            <!-- Inspection Tooltip -->
            <div
                v-if="hoverX !== null && hoverPoints.length > 0"
                class="inspection-tooltip"
                :style="{ left: tooltipLeft + 'px' }"
            >
                <div class="row items-baseline q-gutter-x-sm q-mb-xs">
                    <div class="text-weight-bold">
                        {{ hoverTime?.toFixed(3) }}s
                    </div>
                    <div v-if="absoluteTime" class="text-caption text-grey-7">
                        {{ absoluteTime }}
                    </div>
                </div>
                <div
                    v-for="p in hoverPoints"
                    :key="p.name"
                    class="row items-center q-gutter-x-xs text-caption"
                >
                    <div
                        :style="{ backgroundColor: p.color }"
                        style="width: 8px; height: 8px; border-radius: 50%"
                    ></div>
                    <div>{{ p.name }}: {{ p.value.toFixed(4) }}</div>
                </div>
            </div>

            <div v-if="isSubsampled" class="sampling-badge">
                Subsampled
                <q-tooltip>
                    Data exceeded 10k points. Displaying reduced set for
                    performance.
                </q-tooltip>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

export interface DataPoint {
    time: number; // Relative time in seconds
    value: number;
}

export interface ChartSeries {
    name: string;
    color: string;
    data: DataPoint[];
}

const properties = withDefaults(
    defineProps<{
        series: ChartSeries[];
        title?: string;
        height?: number;
        width?: number;
        // eslint-disable-next-line vue/require-default-prop
        startTime?: bigint; // Absolute start time in nanoseconds
    }>(),
    {
        title: '',
        height: 150,
        width: 1000,
    },
);

const SUBSAMPLE_THRESHOLD = 10_000;
const TARGET_POINTS = 2000;

// --- Scaling Logic (Uses FULL Data for Accuracy) ---
const yRange = computed(() => {
    let min = Infinity;
    let max = -Infinity;

    // Find global min/max across all series (full dataset)
    // Note: Iterating 50k JS objects is fast; rendering 50k DOM nodes is slow.
    for (const s of properties.series) {
        for (const p of s.data) {
            if (p.value < min) min = p.value;
            if (p.value > max) max = p.value;
        }
    }

    // Default / Flat line handling
    if (min === Infinity) {
        min = 0;
        max = 1;
    }
    if (min === max) {
        min -= 1;
        max += 1;
    }

    // Add 10% padding
    const range = max - min;
    return {
        min: min - range * 0.1,
        max: max + range * 0.1,
        range: range * 1.2 || 1, // Avoid div by zero
    };
});

const maxTime = computed(() => {
    let max = 0;
    for (const s of properties.series) {
        if (s.data.length > 0) {
            const last = s.data.at(-1)?.time ?? 0;
            if (last > max) max = last;
        }
    }
    // Avoid division by zero if max is 0 (e.g. single point at t=0)
    return max === 0 ? 1 : max;
});

// --- Subsampling Logic ---
const isSubsampled = computed(() => {
    return properties.series.some((s) => s.data.length > SUBSAMPLE_THRESHOLD);
});

const sampledSeries = computed(() => {
    return properties.series.map((s) => {
        // If small enough, return original
        if (s.data.length <= SUBSAMPLE_THRESHOLD) return s;

        // Calculate stride to reach target count
        const stride = Math.ceil(s.data.length / TARGET_POINTS);

        const reducedData = [];
        for (let index = 0; index < s.data.length; index += stride) {
            reducedData.push(s.data[index]);
        }

        // Ensure the very last point is included so the graph doesn't look cut off
        if (
            reducedData.length > 0 &&
            s.data.length > 0 &&
            reducedData.at(-1) !== s.data.at(-1)
        ) {
            reducedData.push(s.data.at(-1));
        }

        return {
            ...s,
            data: reducedData,
        };
    });
});

// --- Coordinate Mapping ---
const getY = (value: number): number => {
    const percent = (value - yRange.value.min) / yRange.value.range;
    return properties.height * (1 - percent);
};

const getPoints = (data: (DataPoint | undefined)[]): string => {
    return data
        .map((p) => {
            const x = ((p?.time ?? 0) / maxTime.value) * properties.width;
            const y = getY(p?.value ?? 0);
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            return `${x},${y}`;
        })
        .join(' ');
};

const fmt = (n: number): string => n.toFixed(2);

// --- Inspection Logic ---
const graphContainer = ref<HTMLElement | null>(null);
const hoverX = ref<number | null>(null);
const hoverTime = ref<number | null>(null);
const hoverPoints = ref<{ name: string; color: string; value: number }[]>([]);
const tooltipLeft = ref(0);

const absoluteTime = computed(() => {
    if (hoverTime.value === null || properties.startTime === undefined)
        return null;

    // hoverTime is in seconds, startTime is in nanoseconds
    const timeInMs =
        Number(properties.startTime) / 1_000_000 + hoverTime.value * 1000;
    return new Date(timeInMs).toISOString().replace('T', ' ').slice(0, 23);
});

const onMouseMove = (event: MouseEvent) => {
    if (!graphContainer.value) return;

    const rect = graphContainer.value.getBoundingClientRect();
    const x = event.clientX - rect.left;

    // Clamp x to width
    const clampedX = Math.max(0, Math.min(x, rect.width));

    // Map screen X to SVG coordinate X (assuming SVG fills container)
    // Since we use viewBox width=1000, we need to scale
    const scaleX = properties.width / rect.width;
    const svgX = clampedX * scaleX;

    hoverX.value = svgX;

    // Calculate time
    const t = (svgX / properties.width) * maxTime.value;
    hoverTime.value = t;

    // Find closest points
    const points: { name: string; color: string; value: number }[] = [];

    for (const s of properties.series) {
        if (s.data.length === 0) continue;

        // Binary search or simple find for closest time
        // Since data is sorted by time, we can be efficient.
        // For simplicity with small-ish datasets (2k points subsampled), simple scan is ok,
        // but let's do a quick find.

        // Find index where data[i].time >= t
        // We can use the sampledSeries for display, but for values we might want full precision?
        // Actually, using sampledSeries matches what's drawn.

        // Let's use the full series for accurate values if possible, but sampled is fine for UI.
        // Let's use the full series to be accurate.

        // Simple linear search optimization: start from last known index? No, stateless is easier.
        // Binary search is best.

        let low = 0;
        let high = s.data.length - 1;
        let closestIndex = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midPoint = s.data[mid];
            if (!midPoint) {
                // Should not happen if data is consistent
                break;
            }
            if (midPoint.time < t) {
                low = mid + 1;
            } else {
                closestIndex = mid;
                high = mid - 1;
            }
        }

        // closestIdx is the first point >= t.
        // We should check if the previous point is closer.
        let bestPoint = s.data[closestIndex];

        if (closestIndex > 0) {
            const previous = s.data[closestIndex - 1];
            if (
                previous &&
                (!bestPoint ||
                    Math.abs(t - previous.time) < Math.abs(t - bestPoint.time))
            ) {
                bestPoint = previous;
            }
        } else if (closestIndex === -1) {
            // All points are < t, take the last one
            bestPoint = s.data.at(-1);
        }

        if (bestPoint) {
            points.push({
                name: s.name,
                color: s.color,
                value: bestPoint.value,
            });
        }
    }

    hoverPoints.value = points;

    // Tooltip positioning
    // If on right side, show tooltip on left
    tooltipLeft.value =
        clampedX > rect.width / 2 ? clampedX - 160 : clampedX + 20;
};

const onMouseLeave = () => {
    hoverX.value = null;
    hoverTime.value = null;
    hoverPoints.value = [];
};
</script>

<style scoped>
.graph-wrapper {
    position: relative;
    height: v-bind(height + 'px');
    overflow: hidden;
    border: 1px solid #e0e0e0;
    cursor: crosshair;
}
.chart-svg {
    width: 100%;
    height: 100%;
}
.axis-labels {
    position: absolute;
    top: 4px;
    right: 4px;
    bottom: 4px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;
}
.max,
.min {
    font-size: 10px;
    background: rgba(255, 255, 255, 0.7);
    padding: 1px 3px;
    border-radius: 3px;
    color: #555;
    font-weight: 600;
}
.sampling-badge {
    position: absolute;
    bottom: 4px;
    left: 4px;
    font-size: 9px;
    background: rgba(255, 243, 224, 0.9);
    color: #e65100;
    padding: 1px 4px;
    border-radius: 2px;
    cursor: help;
}
.inspection-tooltip {
    position: absolute;
    top: 10px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    pointer-events: none;
    z-index: 10;
    font-size: 11px;
    min-width: 120px;
}
</style>
