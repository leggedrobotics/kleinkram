<template>
    <div class="grid-map-viewer">
        <div class="bg-white rounded-borders border-color q-pa-md">
            <div class="row justify-between items-center q-mb-md">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="grey-3" text-color="black">
                        <q-icon name="sym_o_layers" size="xs" class="q-mr-xs" />
                        {{ layers.length }} Layers
                    </q-badge>
                    <q-badge color="deep-purple-1" text-color="deep-purple-9">
                        {{ info.resolution?.toFixed(3) }}m Res
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

            <div class="row q-col-gutter-md">
                <!-- Info Panel -->
                <div class="col-12 col-md-4">
                    <div class="text-subtitle2 q-mb-sm text-grey-8">
                        Grid Map Info
                    </div>
                    <q-list dense bordered separator class="rounded-borders">
                        <q-item>
                            <q-item-section>Frame ID</q-item-section>
                            <q-item-section side>{{
                                info.header?.frame_id || '-'
                            }}</q-item-section>
                        </q-item>
                        <q-item>
                            <q-item-section>Resolution</q-item-section>
                            <q-item-section side
                                >{{ info.resolution }} m</q-item-section
                            >
                        </q-item>
                        <q-item>
                            <q-item-section>Size (LxW)</q-item-section>
                            <q-item-section side>
                                {{ info.length_x?.toFixed(2) }} x
                                {{ info.length_y?.toFixed(2) }} m
                            </q-item-section>
                        </q-item>
                        <q-item>
                            <q-item-section>Position</q-item-section>
                            <q-item-section side class="text-caption">
                                [{{ info.pose?.position?.x?.toFixed(2) }},
                                {{ info.pose?.position?.y?.toFixed(2) }},
                                {{ info.pose?.position?.z?.toFixed(2) }}]
                            </q-item-section>
                        </q-item>
                    </q-list>
                </div>

                <!-- Layers List -->
                <div class="col-12 col-md-8">
                    <div class="row items-center justify-between q-mb-sm">
                        <div class="text-subtitle2 text-grey-8">Layers</div>
                        <q-select
                            v-model="selectedLayer"
                            :options="layers"
                            dense
                            outlined
                            options-dense
                            label="Preview Layer"
                            class="col-6"
                        />
                    </div>

                    <div class="row q-gutter-sm q-mb-md">
                        <q-chip
                            v-for="layer in layers"
                            :key="layer"
                            :color="
                                layer === selectedLayer ? 'primary' : 'grey-3'
                            "
                            :text-color="
                                layer === selectedLayer ? 'white' : 'black'
                            "
                            icon="sym_o_layers"
                            size="sm"
                            clickable
                            @click="() => selectLayer(layer)"
                        >
                            {{ layer }}
                        </q-chip>
                    </div>

                    <!-- Canvas Preview -->
                    <div
                        class="bg-grey-2 rounded-borders flex flex-center q-pa-sm"
                        style="min-height: 200px"
                    >
                        <canvas
                            ref="canvasReference"
                            style="
                                max-width: 100%;
                                max-height: 300px;
                                image-rendering: pixelated;
                            "
                        ></canvas>
                    </div>

                    <!-- Playback Controls -->
                    <div v-if="messages.length > 1" class="q-mt-md">
                        <PlaybackControls
                            v-model="currentIndex"
                            :max="messages.length - 1"
                            :is-playing="isPlaying"
                            @toggle="togglePlay"
                            @next="nextStep"
                            @prev="previousStep"
                        />
                    </div>

                    <div v-if="basicLayers.length > 0" class="q-mt-md">
                        <div class="text-caption text-grey-7 q-mb-xs">
                            Basic Layers
                        </div>
                        <div class="row q-gutter-sm">
                            <q-chip
                                v-for="layer in basicLayers"
                                :key="layer"
                                outline
                                color="secondary"
                                size="sm"
                            >
                                {{ layer }}
                            </q-chip>
                        </div>
                    </div>
                </div>
            </div>

            <div class="q-mt-lg">
                <div class="text-subtitle2 q-mb-sm">Latest Message Data</div>
                <div class="bg-grey-1 q-pa-sm rounded-borders text-code">
                    <pre class="q-ma-none" style="overflow-x: auto">{{
                        latestMessageJson
                    }}</pre>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { computed, onUnmounted, ref, watch } from 'vue';
import PlaybackControls from './playback-controls.vue';

const properties = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

// --- Playback State ---
const currentIndex = ref(0);
const isPlaying = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let intervalId: any = null;

// Initialize index to last message when messages change (if not playing)
watch(
    () => properties.messages.length,
    (newLength, oldLength) => {
        if (
            newLength > 0 &&
            (oldLength === 0 || !isPlaying.value) && // If it's the first load or we are just viewing the latest, update index
            (currentIndex.value === (oldLength ?? 0) - 1 ||
                (oldLength ?? 0) === 0)
        ) {
            currentIndex.value = newLength - 1;
        }
    },
    { immediate: true },
);

const currentMessage = computed(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    () => properties.messages[currentIndex.value] ?? {},
);
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
const info = computed(() => currentMessage.value.data?.info ?? {});
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
const layers = computed(() => currentMessage.value.data?.layers ?? []);
const basicLayers = computed(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    () => currentMessage.value.data?.basic_layers ?? [],
);

const latestMessageJson = computed(() => {
    if (properties.messages.length === 0) return '{}';

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const message = properties.messages.at(-1);
    // Create a shallow copy to modify for display
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const displayMessage = { ...message };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (displayMessage.data?.data) {
        // Truncate data arrays in the display copy
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        displayMessage.data = { ...displayMessage.data };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        displayMessage.data.data = displayMessage.data.data.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
            (layer: any) => ({
                ...layer,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions
                data: `[Array(${layer.data?.length ?? 0}) - Truncated]`,
            }),
        );
    }

    // Format BigInts for JSON stringify
    return JSON.stringify(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        displayMessage.data ?? {},
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        (_, v) => (typeof v === 'bigint' ? v.toString() : v),
        2,
    );
});

const selectedLayer = ref<string>('');
const canvasReference = ref<HTMLCanvasElement | null>(null);

// Initialize selected layer
watch(
    layers,
    (newLayers) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (newLayers.length > 0 && !selectedLayer.value) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            selectedLayer.value = newLayers[0];
        }
    },
    { immediate: true },
);

// Render map when layer or message changes
watch(
    [selectedLayer, currentMessage],
    () => {
        renderMap();
    },
    { flush: 'post' },
);

// eslint-disable-next-line complexity
function renderMap() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!canvasReference.value || !currentMessage.value.data) return;

    const context = canvasReference.value.getContext('2d');
    if (!context) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const layerIndex = layers.value.indexOf(selectedLayer.value);
    if (layerIndex === -1) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const gridData = currentMessage.value.data.data[layerIndex];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!gridData?.data) return;

    // Calculate dimensions
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const resolution = info.value.resolution ?? 0.1;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const rawWidth = Math.round((info.value.length_x ?? 10) / resolution);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const rawHeight = Math.round((info.value.length_y ?? 10) / resolution);

    // Subsampling Logic: Limit to max 200x200
    const MAX_DIM = 200;
    let width = rawWidth;
    let height = rawHeight;
    let scale = 1;

    if (width > MAX_DIM || height > MAX_DIM) {
        scale = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(rawWidth * scale);
        height = Math.round(rawHeight * scale);
    }

    // Resize canvas
    canvasReference.value.width = width;
    canvasReference.value.height = height;

    // Find min/max for normalization
    let min = Infinity;
    let max = -Infinity;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const data = gridData.data;
    for (const value of data) {
        if (!Number.isNaN(value) && Number.isFinite(value)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            if (value < min) min = value;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            if (value > max) max = value;
        }
    }

    // Draw
    const imgData = context.createImageData(width, height);
    const range = max - min || 1;

    // We need to sample the raw data to the new resolution
    // Simple nearest neighbor or stepping
    const stepX = rawWidth / width;
    const stepY = rawHeight / height;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Map to raw coordinates
            const rawX = Math.floor(x * stepX);
            const rawY = Math.floor(y * stepY);
            const rawIndex = rawY * rawWidth + rawX; // Assuming row-major

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const value = data[rawIndex];
            let color = 0; // Black for NaN/Infinity

            if (!Number.isNaN(value) && Number.isFinite(value)) {
                const norm = (value - min) / range;
                color = Math.floor(norm * 255);
            }

            const index = (y * width + x) * 4;
            imgData.data[index] = color; // R
            imgData.data[index + 1] = color; // G
            imgData.data[index + 2] = color; // B
            imgData.data[index + 3] = 255; // Alpha
        }
    }

    context.putImageData(imgData, 0, 0);
}

// --- Playback Controls ---
const togglePlay = (): void => {
    isPlaying.value = !isPlaying.value;
    if (isPlaying.value) {
        intervalId = setInterval(() => {
            step(1);
        }, 100); // 10 FPS
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        clearInterval(intervalId);
    }
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

onUnmounted(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    clearInterval(intervalId);
});

async function copyRaw(): Promise<void> {
    await quasarCopy(latestMessageJson.value);
    Notify.create({
        message: 'Data copied',
        color: 'positive',
        timeout: 1000,
    });
}

function selectLayer(layer: string) {
    selectedLayer.value = layer;
}

function nextStep() {
    step(1);
}

function previousStep() {
    step(-1);
}
</script>

<style scoped>
.border-color {
    border: 1px solid #e0e0e0;
}
.text-code {
    font-family: monospace;
    font-size: 11px;
}
</style>
