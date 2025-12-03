<template>
    <div
        class="image-sequence-viewer bg-white shadow-1 rounded-borders q-pa-md"
    >
        <!-- Canvas Viewport -->
        <div
            class="relative-position flex flex-center bg-grey-3"
            :class="{
                'overflow-auto': isUltraWide,
                'overflow-hidden': !isUltraWide,
            }"
            style="min-height: 300px"
        >
            <canvas
                ref="canvasReference"
                class="preview-canvas"
                :class="{ 'ultra-wide': isUltraWide }"
            />

            <!-- Overlays -->
            <div
                v-if="renderError"
                class="absolute-center text-negative bg-white q-pa-sm rounded-borders"
            >
                <q-icon name="sym_o_warning" /> {{ renderError }}
            </div>
        </div>

        <!-- Controls -->
        <div class="q-mt-md">
            <PlaybackControls
                v-model="currentIndex"
                :max="messages.length - 1"
                :is-playing="isPlaying"
                @toggle="togglePlay"
                @next="increment"
                @prev="decrement"
            />
        </div>

        <!-- Metadata Footer -->
        <div class="row justify-between q-mt-sm text-caption text-grey-6">
            <div>Time: {{ formatTime(currentMessage?.logTime) }}</div>
            <div>
                Encoding:
                {{
                    currentMessage?.data?.encoding ||
                    currentMessage?.data?.format ||
                    'unknown'
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
            <div v-if="frameSize">Size: {{ frameSize }}</div>
        </div>

        <div v-if="messages.length < totalCount" class="text-center q-mt-md">
            <SmoothLoading
                :current="messages.length"
                :total="totalCount"
                message="Showing {current} / {total} frames."
            />
            <q-btn
                label="Load More"
                icon="sym_o_download"
                size="sm"
                flat
                color="primary"
                @click="emitLoadMore"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useImageDecoder } from '../../../composables/use-image-decoder';
import SmoothLoading from '../../common/smooth-loading.vue';
import PlaybackControls from './playback-controls.vue';

const properties = defineProps<{
    messages: any[];
    totalCount: number;
}>();

const emit = defineEmits(['load-more', 'pause-preview']);

// --- State ---
const canvasReference = ref<HTMLCanvasElement | null>(null);
const currentIndex = ref(0);
const isPlaying = ref(false);
let intervalId: any = null;

// --- Data Access ---
const currentMessage = computed(() => properties.messages[currentIndex.value]);
const frameSize = computed(() => {
    const data = currentMessage.value?.data?.data;
    if (!data) return null;
    let bytes = 0;
    if (data instanceof Uint8Array) {
        bytes = data.byteLength;
    } else if (Array.isArray(data)) {
        // Fallback for array of numbers
        bytes = data.length;
    }
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
});
const currentData = computed(() => currentMessage.value?.data);
const magicBytes = computed(() => {
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

// --- Rendering ---
const { draw, renderError, isDecoded, isUltraWide } = useImageDecoder(
    canvasReference,
    currentData,
);

// Ensure we draw the first frame when mounted/data loaded
onMounted(() => {
    if (currentData.value) {
        draw();
    }
});

// Watch for timeout condition: >100 messages and still no first frame decoded
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
        emit('pause-preview');
    }
});

// --- Playback Logic ---
const inferredInterval = computed(() => {
    if (properties.messages.length < 2) return 100;

    let totalDiff = 0n;
    let count = 0;
    // Check up to first 20 frames to estimate FPS
    const limit = Math.min(properties.messages.length - 1, 20);

    for (let index = 0; index < limit; index++) {
        const t1 = properties.messages[index]?.logTime;
        const t2 = properties.messages[index + 1]?.logTime;

        if (typeof t1 === 'bigint' && typeof t2 === 'bigint' && t2 > t1) {
            totalDiff += t2 - t1;
            count++;
        }
    }

    if (count === 0) return 100;

    const avgNano = Number(totalDiff) / count;
    const avgMs = avgNano / 1_000_000;

    // Clamp to reasonable values (e.g., 1fps to 60fps -> 1000ms to 16ms)
    // If it's too fast, we might not want to render that fast anyway, but let's stick to a reasonable lower bound.
    return Math.max(16, Math.min(1000, avgMs));
});

const togglePlay = (): void => {
    isPlaying.value = !isPlaying.value;
    if (isPlaying.value) {
        intervalId = setInterval(() => {
            step(1);
        }, inferredInterval.value);
    } else {
        clearInterval(intervalId);
    }
};

const increment = (): void => {
    step(1);
};

const decrement = (): void => {
    step(-1);
};

const step = (direction: number): void => {
    let next = currentIndex.value + direction;
    if (next >= properties.messages.length) {
        next = 0; // Loop
    } else if (next < 0) {
        next = properties.messages.length - 1;
    }
    currentIndex.value = next;
};

const formatTime = (nano: bigint): string => {
    const ms = Number(nano / 1_000_000n);
    const date = new Date(ms);

    if (Number.isNaN(date.getTime())) {
        return 'Invalid Time';
    }

    const timePart = date.toISOString().split('T')[1];
    return timePart?.replace('Z', '') ?? 'Invalid Time';
};

onUnmounted(() => {
    clearInterval(intervalId);
});

function emitLoadMore() {
    emit('load-more');
}
</script>

<style scoped>
.preview-canvas {
    max-width: 100%;
    max-height: 400px;
    object-fit: contain;
}

.preview-canvas.ultra-wide {
    max-width: none;
    width: auto;
    object-fit: cover; /* or none, but cover ensures it fills height */
}
</style>
