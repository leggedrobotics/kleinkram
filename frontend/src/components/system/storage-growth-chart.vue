<template>
    <div ref="containerReference" class="growth">
        <svg
            :viewBox="`0 0 ${String(width)} ${String(HEIGHT)}`"
            :width="width"
            :height="HEIGHT"
            role="img"
            :aria-label="summary"
            @mouseleave="clearHover"
        >
            <!-- grid and y axis -->
            <g v-for="tick in ticks" :key="tick">
                <line
                    :x1="LEFT"
                    :x2="right"
                    :y1="y(tick)"
                    :y2="y(tick)"
                    stroke="#e0e0e0"
                />
                <text
                    :x="LEFT - 6"
                    :y="y(tick) + 3"
                    text-anchor="end"
                    class="growth__axis"
                >
                    {{ formatTick(tick) }}
                </text>
            </g>

            <!-- stored: area and line -->
            <path :d="areaPath" fill="#0f62fe" opacity="0.1" />
            <polyline
                :points="usedPoints"
                fill="none"
                stroke="#0f62fe"
                stroke-width="2"
                stroke-linejoin="round"
            />

            <!-- projection at the current rate -->
            <template v-if="projection.length > 1">
                <polyline
                    :points="toPoints(projection)"
                    fill="none"
                    stroke="#0f62fe"
                    stroke-width="2"
                    stroke-dasharray="4 4"
                />
            </template>

            <!-- the current value -->
            <template v-if="lastPoint">
                <circle
                    :cx="lastPoint.x"
                    :cy="lastPoint.y"
                    r="4"
                    fill="#0f62fe"
                    stroke="#fff"
                    stroke-width="2"
                />
                <text
                    :x="lastPoint.x - 6"
                    :y="lastPoint.y - 9"
                    text-anchor="end"
                    class="growth__label"
                >
                    {{ formatSize(lastPoint.bytes) }}
                </text>
            </template>

            <!-- x axis -->
            <text
                v-for="(label, index) in xLabels"
                :key="index"
                :x="label.x"
                :y="HEIGHT - 6"
                text-anchor="middle"
                class="growth__axis"
            >
                {{ label.text }}
            </text>

            <!-- hover: a marker and the value of the month -->
            <template v-if="hoveredPoint">
                <line
                    :x1="hoveredPoint.x"
                    :x2="hoveredPoint.x"
                    :y1="TOP"
                    :y2="BOTTOM"
                    stroke="#8d8d8d"
                    stroke-dasharray="2 2"
                />
                <circle
                    :cx="hoveredPoint.x"
                    :cy="hoveredPoint.y"
                    r="4"
                    fill="#0f62fe"
                    stroke="#fff"
                    stroke-width="2"
                />
                <g :transform="tooltipTransform">
                    <rect
                        :width="TOOLTIP_WIDTH"
                        height="34"
                        rx="4"
                        fill="#161616"
                    />
                    <text x="8" y="14" class="growth__tooltip">
                        {{ monthLabel(hoveredPoint.month, true) }}
                    </text>
                    <text
                        x="8"
                        y="27"
                        class="growth__tooltip growth__tooltip--value"
                    >
                        {{ formatSize(hoveredPoint.bytes) }}
                    </text>
                </g>
            </template>
            <rect
                v-for="(point, index) in points"
                :key="point.month"
                :x="point.x - step / 2"
                :y="TOP"
                :width="step"
                :height="BOTTOM - TOP"
                fill="transparent"
                @mouseenter="() => (hovered = index)"
            >
                <title>
                    {{ monthLabel(point.month, true) }}:
                    {{ formatSize(point.bytes) }} stored
                </title>
            </rect>
        </svg>

        <div class="growth__legend">
            <span><i class="growth__key" />Stored</span>
            <span
                ><i
                    class="growth__key growth__key--projection"
                />Projection</span
            >
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * Stored file data at the end of each month, and a dashed projection of the
 * next 3 months at the average upload rate.
 */
import { formatSize } from 'src/services/general-formatting';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const { monthly, monthlyRate } = defineProps<{
    /** bytes of stored files at the end of each month, oldest first */
    monthly: { month: string; bytes: number }[];
    /** average bytes added per month */
    monthlyRate: number;
}>();

const HEIGHT = 200;
const LEFT = 52;
const TOP = 14;
const BOTTOM = 172;
const PROJECTION_MONTHS = 3;
const TOOLTIP_WIDTH = 96;

interface Point {
    month: string;
    bytes: number;
    x: number;
    y: number;
}

/*
 * Drawn at the real pixel width (not scaled), so text and lines keep their
 * size on every screen
 */
const containerReference = ref<HTMLElement>();
const width = ref(640);
const right = computed(() => width.value - 12);
let observer: ResizeObserver | undefined;
onMounted(() => {
    observer = new ResizeObserver(([entry]) => {
        if (entry) width.value = Math.max(entry.contentRect.width, 320);
    });
    if (containerReference.value) observer.observe(containerReference.value);
});
onBeforeUnmount(() => {
    observer?.disconnect();
});

const hovered = ref<number | undefined>();
const clearHover = (): void => {
    hovered.value = undefined;
};

const projectionMonths = computed(() =>
    monthlyRate > 0 ? PROJECTION_MONTHS : 0,
);

/** "YYYY-MM" plus `offset` months */
const addMonths = (month: string, offset: number): string => {
    const [year, monthIndex] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year ?? 0, (monthIndex ?? 1) - 1 + offset));
    return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (month: string, withYear = false): string => {
    const [year, monthIndex] = month.split('-').map(Number);
    return new Date(
        Date.UTC(year ?? 0, (monthIndex ?? 1) - 1),
    ).toLocaleDateString('en-US', {
        month: 'short',
        year: withYear ? 'numeric' : undefined,
        timeZone: 'UTC',
    });
};

const columns = computed(() => monthly.length + projectionMonths.value);
const step = computed(
    () => (right.value - LEFT) / Math.max(columns.value - 1, 1),
);

const lastBytes = computed(() => monthly.at(-1)?.bytes ?? 0);
const projectedEnd = computed(
    () => lastBytes.value + monthlyRate * projectionMonths.value,
);

const UNITS = [
    { size: 1e12, name: 'TB' },
    { size: 1e9, name: 'GB' },
    { size: 1e6, name: 'MB' },
    { size: 1e3, name: 'kB' },
];

/** The y axis: the largest unit the highest value reaches, GB when empty */
const unit = computed(() => {
    const top = Math.max(projectedEnd.value, ...monthly.map((m) => m.bytes));
    if (top <= 0) return { size: 1e9, name: 'GB' };
    return UNITS.find((u) => top >= u.size) ?? { size: 1, name: 'B' };
});

/** Round tick steps (1, 2, 2.5, 5 × 10ⁿ) for about 4 lines */
const ticks = computed<number[]>(() => {
    const top =
        Math.max(projectedEnd.value, ...monthly.map((m) => m.bytes)) ||
        unit.value.size;
    const rough = top / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const niceStep =
        [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= rough) ??
        rough;
    const count = Math.ceil(top / niceStep);
    return Array.from({ length: count + 1 }, (_, index) => index * niceStep);
});

const yMax = computed(() => ticks.value.at(-1) ?? 1);
const y = (bytes: number): number =>
    BOTTOM - (bytes / yMax.value) * (BOTTOM - TOP);
const x = (index: number): number => LEFT + index * step.value;

const formatTick = (bytes: number): string => {
    const value = bytes / unit.value.size;
    // steps are 1, 2, 2.5 or 5 × 10ⁿ: two decimals tell every tick apart
    return `${String(Number(value.toFixed(2)))} ${unit.value.name}`;
};

const points = computed<Point[]>(() =>
    monthly.map((m, index) => ({
        month: m.month,
        bytes: m.bytes,
        x: x(index),
        y: y(m.bytes),
    })),
);
const lastPoint = computed(() => points.value.at(-1));

const projection = computed<Point[]>(() => {
    const last = lastPoint.value;
    if (!last || projectionMonths.value === 0) return [];
    return Array.from({ length: projectionMonths.value + 1 }, (_, offset) => {
        const bytes = last.bytes + monthlyRate * offset;
        return {
            month: addMonths(last.month, offset),
            bytes,
            x: x(monthly.length - 1 + offset),
            y: y(bytes),
        };
    });
});

const toPoints = (list: Point[]): string =>
    list.map((point) => `${String(point.x)},${String(point.y)}`).join(' ');
const usedPoints = computed(() => toPoints(points.value));
const areaPath = computed(() => {
    const list = points.value;
    if (list.length === 0) return '';
    const first = list[0];
    const last = list.at(-1);
    if (!first || !last) return '';
    return `M${String(first.x)},${String(BOTTOM)} ${list
        .map((point) => `L${String(point.x)},${String(point.y)}`)
        .join(' ')} L${String(last.x)},${String(BOTTOM)} Z`;
});

/** Every other month, ending with the newest, plus the projected ones */
const xLabels = computed(() => {
    const all = [...points.value, ...projection.value.slice(1)];
    return all
        .filter((_, index) => (all.length - 1 - index) % 2 === 0)
        .map((point) => ({ x: point.x, text: monthLabel(point.month) }));
});

const hoveredPoint = computed(() =>
    hovered.value === undefined ? undefined : points.value[hovered.value],
);
const tooltipTransform = computed(() => {
    const point = hoveredPoint.value;
    if (!point) return '';
    const left = Math.min(point.x + 8, right.value - TOOLTIP_WIDTH);
    const top = Math.max(point.y - 44, TOP);
    return `translate(${String(left)}, ${String(top)})`;
});

const summary = computed(() => {
    const first = monthly[0];
    const last = monthly.at(-1);
    if (!first || !last) return 'Stored file data per month';
    return `Stored file data per month, ${monthLabel(first.month, true)} to ${monthLabel(last.month, true)}, now ${formatSize(last.bytes)}`;
});
</script>

<style scoped>
/* $text-helper */
.growth__axis {
    fill: #6f6f6f;
    font-size: 10px;
}

/* $text-primary */
.growth__label {
    fill: #161616;
    font-size: 11px;
    font-weight: 500;
}

.growth__tooltip {
    fill: #f4f4f4;
    font-size: 10px;
}

.growth__tooltip--value {
    fill: #ffffff;
    font-size: 11px;
    font-weight: 600;
}

/* $text-secondary */
.growth__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 4px;
    color: #525252;
    font-size: 12px;
}

.growth__key {
    display: inline-block;
    width: 14px;
    height: 0;
    margin-right: 6px;
    border-top: 2px solid #0f62fe;
    vertical-align: 3px;
}

.growth__key--projection {
    border-top-style: dashed;
}
</style>
