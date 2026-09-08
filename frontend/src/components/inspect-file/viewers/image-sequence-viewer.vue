<template>
    <div
        class="image-sequence-viewer rounded-borders overflow-hidden"
        tabindex="0"
        @keydown="onKeyDown"
    >
        <!-- Viewport -->
        <div
            class="viewport relative-position flex flex-center"
            :class="{ 'overflow-auto': isUltraWide }"
            @click="togglePlay"
        >
            <canvas
                ref="canvasReference"
                class="preview-canvas"
                :class="{ 'ultra-wide': isUltraWide }"
            />

            <div
                v-if="renderError"
                class="absolute-center text-negative bg-white q-pa-sm rounded-borders"
                @click.stop
            >
                <q-icon name="sym_o_warning" /> {{ renderError }}
            </div>
            <div
                v-else-if="messages.length === 0"
                class="absolute-center column items-center text-grey-5"
            >
                <q-spinner-dots size="2em" color="white" />
                <div class="q-mt-sm text-caption">Loading frames…</div>
            </div>

            <div
                v-if="isLoading && messages.length > 0"
                class="loading-indicator text-caption"
            >
                <q-spinner size="12px" color="white" class="q-mr-xs" />
                Loading frames · {{ messages.length }} / {{ totalCount }}
            </div>
        </div>

        <!-- Controls -->
        <div class="controls">
            <div
                ref="timelineReference"
                class="timeline"
                @pointerdown="onScrubStart"
                @pointermove="onScrubMove"
                @pointerup="onScrubEnd"
                @pointercancel="onScrubEnd"
            >
                <svg
                    class="timeline-svg"
                    :viewBox="`0 0 1000 12`"
                    preserveAspectRatio="none"
                >
                    <!-- Loaded frames -->
                    <line
                        v-for="(x, index) in loadedTicks"
                        :key="index"
                        :x1="x"
                        :x2="x"
                        y1="2"
                        y2="10"
                        class="tick"
                    />
                    <!-- Played portion -->
                    <rect
                        x="0"
                        y="5"
                        :width="playedFraction * 1000"
                        height="2"
                        class="played"
                    />
                </svg>
                <div
                    class="playhead"
                    :style="{ left: `${(playedFraction * 100).toFixed(3)}%` }"
                />
            </div>

            <div class="row items-center no-wrap q-gutter-x-xs">
                <q-btn
                    flat
                    dense
                    round
                    color="white"
                    :icon="isPlaying ? 'sym_o_pause' : 'sym_o_play_arrow'"
                    @click="togglePlay"
                >
                    <q-tooltip
                        >{{ isPlaying ? 'Pause' : 'Play' }} (space)</q-tooltip
                    >
                </q-btn>
                <q-btn
                    flat
                    dense
                    round
                    size="sm"
                    color="white"
                    icon="sym_o_skip_previous"
                    @click="previousFrame"
                >
                    <q-tooltip>Previous frame (←)</q-tooltip>
                </q-btn>
                <q-btn
                    flat
                    dense
                    round
                    size="sm"
                    color="white"
                    icon="sym_o_skip_next"
                    @click="nextFrame"
                >
                    <q-tooltip>Next frame (→)</q-tooltip>
                </q-btn>

                <div class="time-display text-caption q-ml-sm">
                    {{ formatDuration(playhead) }}
                    <span class="text-grey-5">
                        / {{ formatDuration(duration) }}
                    </span>
                </div>

                <q-space />

                <div class="text-caption text-grey-5 q-mr-sm gt-xs">
                    Frame {{ currentIndex + 1 }} / {{ messages.length }}
                    <template v-if="sampleStride > 1">
                        · every {{ sampleStride }}th
                    </template>
                </div>

                <q-btn-dropdown
                    flat
                    dense
                    no-caps
                    color="white"
                    :label="`${formatSpeed(speed)}×`"
                    content-class="speed-menu"
                >
                    <q-list dense>
                        <q-item
                            v-for="option in SPEED_OPTIONS"
                            :key="option"
                            v-close-popup
                            clickable
                            :active="option === speed"
                            @click="() => setSpeed(option)"
                        >
                            <q-item-section>
                                {{ formatSpeed(option) }}×
                                <span
                                    v-if="option === 1"
                                    class="text-caption text-grey-6"
                                >
                                    capture speed
                                </span>
                            </q-item-section>
                        </q-item>
                    </q-list>
                    <q-tooltip>Playback speed</q-tooltip>
                </q-btn-dropdown>
            </div>
        </div>

        <!-- Metadata Footer -->
        <div
            class="row justify-between q-px-md q-py-xs text-caption text-grey-6"
        >
            <div>{{ formatWallTime(currentMessage?.logTime) }}</div>
            <div>
                {{
                    currentMessage?.data?.encoding ||
                    currentMessage?.data?.format ||
                    'unknown encoding'
                }}
                <q-tooltip
                    v-if="
                        (!currentMessage?.data?.encoding &&
                            !currentMessage?.data?.format) ||
                        currentMessage?.data?.encoding === 'unknown'
                    "
                >
                    Magic bytes: {{ magicBytes }}
                </q-tooltip>
            </div>
            <div v-if="frameSize">{{ frameSize }}</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useImageDecoder } from '../../../composables/use-image-decoder';

const properties = withDefaults(
    defineProps<{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: any[];
        totalCount: number;
        isLoading?: boolean;
        /** Only every n-th frame is loaded (1 = all frames) */
        sampleStride?: number;
        /** Whether more frames can still be loaded in the background */
        canRefine?: boolean;
    }>(),
    { isLoading: false, sampleStride: 1, canRefine: false },
);

const emit = defineEmits(['load-more', 'pause-preview']);

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4, 8];

// --- Recording time base ---
const startTime = computed<bigint>(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    () => properties.messages[0]?.logTime ?? 0n,
);

const frameTimes = computed<number[]>(() =>
    properties.messages.map(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (message) => Number(message.logTime - startTime.value) / 1e9,
    ),
);

/** Duration of the recording in seconds (first to last loaded frame) */
const duration = computed(() => frameTimes.value.at(-1) ?? 0);

// --- Playback state ---
const playhead = ref(0); // seconds since the first frame
const isPlaying = ref(false);
const speed = ref(1);

/** Index of the last loaded frame at or before the playhead */
const currentIndex = computed(() => {
    const times = frameTimes.value;
    if (times.length === 0) return 0;
    let low = 0;
    let high = times.length - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if ((times[mid] ?? 0) <= playhead.value) low = mid;
        else high = mid - 1;
    }
    return low;
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
const currentMessage = computed(() => properties.messages[currentIndex.value]);
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
const currentData = computed(() => currentMessage.value?.data);

const playedFraction = computed(() =>
    duration.value > 0 ? Math.min(1, playhead.value / duration.value) : 0,
);

const loadedTicks = computed(() => {
    if (duration.value <= 0) return [];
    return frameTimes.value.map((t) => (t / duration.value) * 1000);
});

// --- Playback loop (real time × speed) ---
let animationFrame: number | null = null;
let lastTick = 0;

const tick = (now: number): void => {
    if (!isPlaying.value) return;
    const elapsed = (now - lastTick) / 1000;
    lastTick = now;
    let next = playhead.value + elapsed * speed.value;
    if (next > duration.value) next = 0; // loop
    playhead.value = next;
    animationFrame = requestAnimationFrame(tick);
};

const play = (): void => {
    if (isPlaying.value || properties.messages.length === 0) return;
    isPlaying.value = true;
    lastTick = performance.now();
    animationFrame = requestAnimationFrame(tick);
};

const pause = (): void => {
    isPlaying.value = false;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
};

const togglePlay = (): void => {
    if (isPlaying.value) pause();
    else play();
};

const setSpeed = (value: number): void => {
    speed.value = value;
};

const stepFrame = (direction: 1 | -1): void => {
    pause();
    const times = frameTimes.value;
    if (times.length === 0) return;
    const next = Math.min(
        times.length - 1,
        Math.max(0, currentIndex.value + direction),
    );
    playhead.value = times[next] ?? 0;
};

// --- Scrubbing ---
const timelineReference = ref<HTMLDivElement | null>(null);
let scrubbing = false;
let wasPlaying = false;

const seekToEvent = (event: PointerEvent): void => {
    if (!timelineReference.value) return;
    const rect = timelineReference.value.getBoundingClientRect();
    const fraction = Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width),
    );
    playhead.value = fraction * duration.value;
};

const onScrubStart = (event: PointerEvent): void => {
    scrubbing = true;
    wasPlaying = isPlaying.value;
    pause();
    timelineReference.value?.setPointerCapture(event.pointerId);
    seekToEvent(event);
};

const onScrubMove = (event: PointerEvent): void => {
    if (scrubbing) seekToEvent(event);
};

const onScrubEnd = (): void => {
    if (!scrubbing) return;
    scrubbing = false;
    if (wasPlaying) play();
};

// --- Keyboard ---
const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
    }
    switch (event.key) {
        case ' ': {
            event.preventDefault();
            togglePlay();
            break;
        }
        case 'ArrowRight': {
            stepFrame(1);
            break;
        }
        case 'ArrowLeft': {
            stepFrame(-1);
            break;
        }
        default: {
            break;
        }
    }
};

const previousFrame = (): void => {
    stepFrame(-1);
};

const nextFrame = (): void => {
    stepFrame(1);
};

// --- Rendering ---
const canvasReference = ref<HTMLCanvasElement | null>(null);
const { draw, renderError, isDecoded, isUltraWide } = useImageDecoder(
    canvasReference,
    currentData,
);

onMounted(() => {
    if (currentData.value) draw();
    // Re-expanded with a finished sampled load: continue refining
    if (
        !properties.isLoading &&
        properties.canRefine &&
        properties.messages.length > 0
    ) {
        emit('load-more');
    }
});

onUnmounted(() => {
    pause();
});

watch(
    () => properties.messages.length,
    (count) => {
        if (count > 100 && !isDecoded.value && !renderError.value) {
            renderError.value =
                'Timeout: No valid frame found after 100 messages';
        }
    },
);

watch(renderError, (error) => {
    if (error) {
        pause();
        emit('pause-preview');
    }
});

// --- Background refinement ---
// Once a load finished, ask for the next (denser) sample until every frame
// (or the frame budget) is loaded. The playback keeps running meanwhile.
watch(
    () => properties.isLoading,
    (loading, wasLoading) => {
        if (
            wasLoading &&
            !loading &&
            !renderError.value &&
            properties.canRefine &&
            properties.messages.length > 0
        ) {
            setTimeout(() => {
                if (properties.canRefine && !properties.isLoading) {
                    emit('load-more');
                }
            }, 250);
        }
    },
);

// --- Formatting ---
const formatDuration = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0';
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${String(minutes)}:${rest.toFixed(1).padStart(4, '0')}`;
};

const formatSpeed = (value: number): string =>
    Number.isInteger(value)
        ? String(value)
        : value.toFixed(2).replace(/0$/, '');

const formatWallTime = (nano: bigint | undefined): string => {
    if (nano === undefined) return '';
    const date = new Date(Number(nano / 1_000_000n));
    if (Number.isNaN(date.getTime())) return 'Invalid time';
    return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
};

const frameSize = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const data = currentMessage.value?.data?.data;
    if (!data) return null;
    let bytes = 0;
    if (data instanceof Uint8Array) {
        bytes = data.byteLength;
    } else if (Array.isArray(data)) {
        bytes = data.length;
    }
    if (bytes < 1024) return `${String(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
});

const magicBytes = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const data = currentData.value?.data;
    if (!data) return '';
    let bytes: Uint8Array | number[] = [];
    if (data instanceof Uint8Array) {
        bytes = data.slice(0, 4);
    } else if (Array.isArray(data)) {
        bytes = data.slice(0, 4);
    } else {
        return '';
    }
    return [...bytes]
        .map((b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`)
        .join(' ');
});
</script>

<style scoped>
.image-sequence-viewer {
    background: #111;
    color: #fff;
    border: 1px solid #333;
    outline: none;
}

.image-sequence-viewer:focus-visible {
    box-shadow: 0 0 0 2px #1976d2;
}

.viewport {
    height: 420px;
    background: #000;
    cursor: pointer;
}

.preview-canvas {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.preview-canvas.ultra-wide {
    max-width: none;
    width: auto;
    height: 100%;
    object-fit: cover;
}

.loading-indicator {
    position: absolute;
    top: 8px;
    left: 8px;
    background: rgba(0, 0, 0, 0.6);
    padding: 2px 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
}

.controls {
    padding: 6px 12px 4px;
    background: #1c1c1c;
}

.timeline {
    position: relative;
    height: 14px;
    cursor: pointer;
    touch-action: none;
    margin-bottom: 4px;
}

.timeline-svg {
    width: 100%;
    height: 100%;
    display: block;
}

.tick {
    stroke: rgba(255, 255, 255, 0.25);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
}

.played {
    fill: #1976d2;
}

.playhead {
    position: absolute;
    top: 1px;
    width: 3px;
    height: 12px;
    margin-left: -1.5px;
    background: #fff;
    border-radius: 2px;
    pointer-events: none;
}

.time-display {
    font-variant-numeric: tabular-nums;
    min-width: 110px;
}
</style>
