<template>
    <div
        ref="container"
        class="track-map bg-grey-2 rounded-borders relative-position overflow-hidden non-selectable"
        :class="{ dragging: isDragging }"
        :style="{ height: `${String(height)}px` }"
        @mousedown="onDragStart"
        @mousemove="onDragMove"
        @mouseup="onDragEnd"
        @mouseleave="onDragEnd"
        @wheel.prevent="onWheel"
    >
        <template v-if="hasPoints">
            <img
                v-for="tile in tiles"
                :key="tile.key"
                :src="tile.url"
                class="map-tile"
                :style="{
                    left: `${String(tile.left)}px`,
                    top: `${String(tile.top)}px`,
                }"
                alt=""
                draggable="false"
                loading="lazy"
            />

            <svg
                class="track-overlay absolute-full"
                :viewBox="`0 0 ${String(size.width)} ${String(size.height)}`"
            >
                <polyline
                    :points="trackPoints"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="5"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                    opacity="0.9"
                />
                <polyline
                    :points="trackPoints"
                    fill="none"
                    stroke="#1976d2"
                    stroke-width="2.5"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                />
                <circle
                    v-if="startPixel"
                    :cx="startPixel.x"
                    :cy="startPixel.y"
                    r="5"
                    fill="#4caf50"
                    stroke="#fff"
                    stroke-width="2"
                />
                <circle
                    v-if="endPixel"
                    :cx="endPixel.x"
                    :cy="endPixel.y"
                    r="6"
                    fill="#f44336"
                    stroke="#fff"
                    stroke-width="2"
                />
            </svg>

            <div class="map-controls column q-gutter-y-xs">
                <q-btn
                    dense
                    unelevated
                    size="sm"
                    color="white"
                    text-color="grey-9"
                    icon="sym_o_add"
                    @click.stop="zoomIn"
                >
                    <q-tooltip>Zoom in</q-tooltip>
                </q-btn>
                <q-btn
                    dense
                    unelevated
                    size="sm"
                    color="white"
                    text-color="grey-9"
                    icon="sym_o_remove"
                    @click.stop="zoomOut"
                >
                    <q-tooltip>Zoom out</q-tooltip>
                </q-btn>
                <q-btn
                    dense
                    unelevated
                    size="sm"
                    color="white"
                    text-color="grey-9"
                    icon="sym_o_fit_screen"
                    @click.stop="fitToTrack"
                >
                    <q-tooltip>Fit track</q-tooltip>
                </q-btn>
            </div>

            <div class="map-legend row items-center q-gutter-x-sm text-caption">
                <span class="legend-dot" style="background: #4caf50"></span>
                Start
                <span class="legend-dot" style="background: #f44336"></span>
                End
            </div>

            <div class="map-attribution text-caption">
                ©
                <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener"
                    >OpenStreetMap</a
                >
                contributors
            </div>
        </template>
        <div v-else class="absolute-full flex flex-center text-grey-6">
            No valid GNSS positions to display
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { GeoPoint } from './geo';

/**
 * Lightweight slippy map that renders OpenStreetMap tiles and a GNSS track
 * on top, without any mapping library.
 */

const properties = withDefaults(
    defineProps<{
        points: GeoPoint[];
        height?: number;
    }>(),
    { height: 320 },
);

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 19;

const container = ref<HTMLDivElement>();
const size = ref({ width: 800, height: properties.height });

// View state: zoom level and the world pixel coordinate at the view centre
const zoom = ref(MIN_ZOOM);
const center = ref({ x: 0, y: 0 });

const validPoints = computed(() =>
    properties.points.filter(
        (p) =>
            Number.isFinite(p.lat) &&
            Number.isFinite(p.lon) &&
            Math.abs(p.lat) <= 85 &&
            Math.abs(p.lon) <= 180,
    ),
);
const hasPoints = computed(() => validPoints.value.length > 0);

// --- Web Mercator helpers (world pixels at a given zoom) ---
const worldSize = (z: number): number => TILE_SIZE * 2 ** z;

const project = (p: GeoPoint, z: number): { x: number; y: number } => {
    const scale = worldSize(z);
    const sinLat = Math.sin((p.lat * Math.PI) / 180);
    return {
        x: ((p.lon + 180) / 360) * scale,
        y:
            (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
            scale,
    };
};

const toScreen = (world: {
    x: number;
    y: number;
}): { x: number; y: number } => ({
    x: world.x - center.value.x + size.value.width / 2,
    y: world.y - center.value.y + size.value.height / 2,
});

// --- Fit the whole track into the view ---
const fitToTrack = (): void => {
    if (!hasPoints.value) return;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const p of validPoints.value) {
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
        minLon = Math.min(minLon, p.lon);
        maxLon = Math.max(maxLon, p.lon);
    }

    const padding = 40;
    const availableWidth = Math.max(1, size.value.width - 2 * padding);
    const availableHeight = Math.max(1, size.value.height - 2 * padding);

    let bestZoom = MIN_ZOOM;
    for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
        const a = project({ lat: maxLat, lon: minLon }, z);
        const b = project({ lat: minLat, lon: maxLon }, z);
        if (b.x - a.x <= availableWidth && b.y - a.y <= availableHeight) {
            bestZoom = z;
            break;
        }
    }
    // A stationary receiver would otherwise zoom to the maximum level
    zoom.value = Math.min(bestZoom, 18);

    const a = project({ lat: maxLat, lon: minLon }, zoom.value);
    const b = project({ lat: minLat, lon: maxLon }, zoom.value);
    center.value = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
};

const zoomBy = (delta: number): void => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value + delta));
    if (next === zoom.value) return;
    const factor = 2 ** (next - zoom.value);
    center.value = { x: center.value.x * factor, y: center.value.y * factor };
    zoom.value = next;
};

const zoomIn = (): void => {
    zoomBy(1);
};

const zoomOut = (): void => {
    zoomBy(-1);
};

const onWheel = (event: WheelEvent): void => {
    zoomBy(event.deltaY < 0 ? 1 : -1);
};

// --- Dragging ---
const isDragging = ref(false);
let dragLast = { x: 0, y: 0 };

const onDragStart = (event: MouseEvent): void => {
    if (!hasPoints.value) return;
    isDragging.value = true;
    dragLast = { x: event.clientX, y: event.clientY };
};

const onDragMove = (event: MouseEvent): void => {
    if (!isDragging.value) return;
    center.value = {
        x: center.value.x - (event.clientX - dragLast.x),
        y: center.value.y - (event.clientY - dragLast.y),
    };
    dragLast = { x: event.clientX, y: event.clientY };
};

const onDragEnd = (): void => {
    isDragging.value = false;
};

// --- Tiles visible in the current view ---
const tiles = computed(() => {
    if (!hasPoints.value) return [];
    const z = zoom.value;
    const tileCount = 2 ** z;
    const left = center.value.x - size.value.width / 2;
    const top = center.value.y - size.value.height / 2;

    const firstX = Math.floor(left / TILE_SIZE);
    const lastX = Math.floor((left + size.value.width) / TILE_SIZE);
    const firstY = Math.max(0, Math.floor(top / TILE_SIZE));
    const lastY = Math.min(
        tileCount - 1,
        Math.floor((top + size.value.height) / TILE_SIZE),
    );

    const result: { key: string; url: string; left: number; top: number }[] =
        [];
    for (let tx = firstX; tx <= lastX; tx++) {
        // Wrap horizontally across the antimeridian
        const wrappedX = ((tx % tileCount) + tileCount) % tileCount;
        for (let ty = firstY; ty <= lastY; ty++) {
            result.push({
                key: `${String(z)}/${String(tx)}/${String(ty)}`,
                url: `https://tile.openstreetmap.org/${String(z)}/${String(wrappedX)}/${String(ty)}.png`,
                left: tx * TILE_SIZE - left,
                top: ty * TILE_SIZE - top,
            });
        }
    }
    return result;
});

// --- Track in screen coordinates ---
const screenPoints = computed(() =>
    validPoints.value.map((p) => toScreen(project(p, zoom.value))),
);

const trackPoints = computed(() =>
    screenPoints.value
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' '),
);

const startPixel = computed(() => screenPoints.value[0]);
const endPixel = computed(() => screenPoints.value.at(-1));

// --- Sizing ---
let resizeObserver: ResizeObserver | undefined;

const measure = (): void => {
    if (!container.value) return;
    size.value = {
        width: container.value.clientWidth || 800,
        height: container.value.clientHeight || properties.height,
    };
};

onMounted(() => {
    measure();
    fitToTrack();
    if (typeof ResizeObserver !== 'undefined' && container.value) {
        resizeObserver = new ResizeObserver(() => {
            measure();
        });
        resizeObserver.observe(container.value);
    }
});

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
});

// Re-fit when the first points arrive (streaming load) and when the point
// count grows substantially, but leave the view alone while the user pans.
let fittedCount = 0;
watch(
    () => validPoints.value.length,
    (count) => {
        if (count === 0) return;
        if (fittedCount === 0 || count > fittedCount * 2) {
            fitToTrack();
            fittedCount = count;
        }
    },
    { immediate: true },
);
</script>

<style scoped>
.track-map {
    cursor: grab;
    border: 1px solid #e0e0e0;
}

.track-map.dragging {
    cursor: grabbing;
}

.map-tile {
    position: absolute;
    width: 256px;
    height: 256px;
    pointer-events: none;
}

.track-overlay {
    pointer-events: none;
}

.map-controls {
    position: absolute;
    top: 8px;
    right: 8px;
}

.map-legend {
    position: absolute;
    top: 8px;
    left: 8px;
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 8px;
    border-radius: 4px;
}

.legend-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1.5px solid #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
}

.map-attribution {
    position: absolute;
    bottom: 0;
    right: 0;
    background: rgba(255, 255, 255, 0.8);
    padding: 1px 6px;
    font-size: 10px;
}
</style>
