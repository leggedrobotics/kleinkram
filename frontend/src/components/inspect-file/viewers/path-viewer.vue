<template>
    <div class="path-viewer">
        <div
            class="bg-white rounded-borders border-color q-pa-md transition-generic"
        >
            <div class="row justify-between items-center q-mb-md">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="purple-1" text-color="purple-9">
                        <q-icon
                            name="sym_o_timeline"
                            size="xs"
                            class="q-mr-xs"
                        />
                        {{ messages.length }} Paths
                    </q-badge>
                    <q-badge color="blue-1" text-color="blue-9">
                        {{ currentPathPointCount }} Points
                    </q-badge>
                </div>
                <div class="row items-center q-gutter-x-sm">
                    <q-toggle
                        v-model="showMap"
                        label="Show Background Map"
                        color="primary"
                        dense
                        left-label
                    />
                    <q-badge outline color="grey-7">
                        Frame: {{ frameId }}
                    </q-badge>
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
            </div>

            <!-- Playback / Slider -->
            <div
                v-if="messages.length > 1"
                class="row items-center q-mb-md q-gutter-x-md"
            >
                <q-btn
                    :icon="isPlaying ? 'sym_o_pause' : 'sym_o_play_arrow'"
                    flat
                    round
                    dense
                    color="primary"
                    @click="togglePlayback"
                />
                <q-slider
                    v-model="currentIndex"
                    :min="0"
                    :max="messages.length - 1"
                    label
                    color="primary"
                    class="col"
                />
                <div
                    class="text-caption text-grey-7"
                    style="min-width: 40px; text-align: right"
                >
                    {{ currentIndex + 1 }} / {{ messages.length }}
                </div>
            </div>

            <!-- Canvas Container -->
            <div
                ref="containerReference"
                class="canvas-container bg-grey-1 rounded-borders relative-position"
            >
                <canvas ref="canvasReference" class="path-canvas"></canvas>

                <div
                    v-if="isLoading && messages.length === 0"
                    class="absolute-full flex flex-center"
                >
                    <q-spinner-dots color="primary" size="2em" />
                </div>
                <div
                    v-else-if="messages.length === 0"
                    class="absolute-full flex flex-center text-grey-5"
                >
                    No Path Data
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const properties = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required']);

const containerReference = ref<HTMLElement | null>(null);
const canvasReference = ref<HTMLCanvasElement | null>(null);
const currentIndex = ref(0);
const isPlaying = ref(false);
const showMap = ref(false);
let playbackInterval: number | null = null;

const isLoading = computed(
    () => properties.messages.length < properties.totalCount,
);

onMounted(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!properties.messages || properties.messages.length === 0)
        emit('load-required');

    // Init resize observer
    if (containerReference.value) {
        const observer = new ResizeObserver(() => {
            void renderPath();
        });
        observer.observe(containerReference.value);
    }

    // checkWgs84Default(); // Disabled as per request
});

onUnmounted(() => {
    stopPlayback();
});

// Auto-update index to latest if we were at the end
watch(
    () => properties.messages.length,
    (newLength, oldLength) => {
        if (newLength > oldLength && currentIndex.value === oldLength - 1) {
            currentIndex.value = newLength - 1;
        }
        // checkWgs84Default(); // Disabled
    },
);

watch(currentIndex, () => {
    void renderPath();
});

watch(showMap, () => {
    void renderPath();
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
const currentMessage = computed(() => properties.messages[currentIndex.value]);
const currentPathPointCount = computed(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    () => currentMessage.value?.data?.poses?.length ?? 0,
);
const frameId = computed(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    () => currentMessage.value?.data?.header?.frame_id ?? '-',
);

/*
function checkWgs84Default() {
    if (properties.messages.length > 0) {
        const lastMsg = properties.messages[properties.messages.length - 1];
        if (lastMsg?.data?.poses && isWgs84(lastMsg.data.poses)) {
            showMap.value = true;
        }
    }
}
*/

function togglePlayback() {
    if (isPlaying.value) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

function startPlayback() {
    if (currentIndex.value >= properties.messages.length - 1) {
        currentIndex.value = 0;
    }
    isPlaying.value = true;
    playbackInterval = globalThis.setInterval(() => {
        if (currentIndex.value < properties.messages.length - 1) {
            currentIndex.value++;
        } else {
            stopPlayback();
        }
    }, 100) as unknown as number; // 10fps
}

function stopPlayback() {
    isPlaying.value = false;
    if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
}

// --- OSM Logic ---

function lat2tile(lat: number, zoom: number): number {
    return (
        ((1 -
            Math.log(
                Math.tan((lat * Math.PI) / 180) +
                    1 / Math.cos((lat * Math.PI) / 180),
            ) /
                Math.PI) /
            2) *
        Math.pow(2, zoom)
    );
}

function lon2tile(lon: number, zoom: number): number {
    return ((lon + 180) / 360) * Math.pow(2, zoom);
}

const TILE_SIZE = 256;

async function renderPath() {
    const canvas = canvasReference.value;
    const container = containerReference.value;
    if (!canvas || !container || !currentMessage.value) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const poses = currentMessage.value.data.poses;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!poses || poses.length === 0) {
        const context = canvas.getContext('2d');
        if (context) context.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    // Resize canvas
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Find bounds
    let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
    for (const p of poses) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const x = p.pose.position.x;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const y = p.pose.position.y;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        if (x < minX) minX = x;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        if (x > maxX) maxX = x;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        if (y < minY) minY = y;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        if (y > maxY) maxY = y;
    }

    if (showMap.value) {
        await renderGeoPath(
            context,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            poses,
            minX,
            maxX,
            minY,
            maxY,
            canvas.width,
            canvas.height,
        );
    } else {
        renderLocalPath(
            context,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            poses,
            minX,
            maxX,
            minY,
            maxY,
            canvas.width,
            canvas.height,
        );
    }
}

function renderLocalPath(
    context: CanvasRenderingContext2D,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    poses: any[],
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    width: number,
    height: number,
) {
    const padding = 20;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const scaleX = (width - padding * 2) / rangeX;
    const scaleY = (height - padding * 2) / rangeY;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (width - rangeX * scale) / 2 - minX * scale;
    const offsetY = (height - rangeY * scale) / 2 - minY * scale;

    context.clearRect(0, 0, width, height);

    // Grid
    context.strokeStyle = '#eee';
    context.lineWidth = 1;
    context.beginPath();
    // TODO: Draw grid
    context.stroke();

    // Path
    context.strokeStyle = '#2196F3';
    context.lineWidth = 2;
    context.beginPath();

    const transformX = (x: number) => x * scale + offsetX;
    const transformY = (y: number) => height - (y * scale + offsetY);

    for (const [index, p] of poses.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const x = transformX(p.pose.position.x);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const y = transformY(p.pose.position.y);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    }
    context.stroke();

    drawEndpoints(context, poses, transformX, transformY);
}

async function renderGeoPath(
    context: CanvasRenderingContext2D,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    poses: any[],
    minLon: number,
    maxLon: number,
    minLat: number,
    maxLat: number,
    width: number,
    height: number,
) {
    // 1. Calculate Zoom Level
    // We want the bounding box to fit in the canvas
    // const latDiff = maxLat - minLat;
    // const lonDiff = maxLon - minLon;

    // Rough estimate
    let zoom = 1;
    for (let z = 1; z <= 19; z++) {
        const tileX1 = lon2tile(minLon, z);
        const tileX2 = lon2tile(maxLon, z);
        const tileY1 = lat2tile(maxLat, z); // Max lat is smaller Y (top)
        const tileY2 = lat2tile(minLat, z);

        const pixelW = (tileX2 - tileX1) * TILE_SIZE;
        const pixelH = (tileY2 - tileY1) * TILE_SIZE;

        if (pixelW > width || pixelH > height) {
            zoom = z - 1;
            break;
        }
        zoom = z;
    }
    zoom = Math.max(0, Math.min(19, zoom));

    // 2. Calculate Center in Pixels
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const centerX = lon2tile(centerLon, zoom) * TILE_SIZE;
    const centerY = lat2tile(centerLat, zoom) * TILE_SIZE;

    // 3. Viewport Offset
    const viewX = centerX - width / 2;
    const viewY = centerY - height / 2;

    // 4. Draw Tiles
    const startTileX = Math.floor(viewX / TILE_SIZE);
    const endTileX = Math.floor((viewX + width) / TILE_SIZE);
    const startTileY = Math.floor(viewY / TILE_SIZE);
    const endTileY = Math.floor((viewY + height) / TILE_SIZE);

    context.clearRect(0, 0, width, height);

    const promises = [];
    for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
            promises.push(loadTile(tx, ty, zoom));
        }
    }

    const tiles = await Promise.all(promises);

    for (const tile of tiles) {
        if (tile?.img) {
            const x = tile.tx * TILE_SIZE - viewX;
            const y = tile.ty * TILE_SIZE - viewY;
            context.drawImage(tile.img, x, y);
        }
    }

    // 5. Draw Path
    context.strokeStyle = '#2196F3';
    context.lineWidth = 3;
    context.beginPath();

    const transformX = (lon: number) => lon2tile(lon, zoom) * TILE_SIZE - viewX;
    const transformY = (lat: number) => lat2tile(lat, zoom) * TILE_SIZE - viewY;

    for (const [index, p] of poses.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const x = transformX(p.pose.position.x);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const y = transformY(p.pose.position.y);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    }
    context.stroke();

    drawEndpoints(context, poses, transformX, transformY);

    // Attribution
    context.font = '10px sans-serif';
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillText('© OpenStreetMap contributors', width - 130, height - 5);
}

const tileCache = new Map<string, HTMLImageElement>();

async function loadTile(
    x: number,
    y: number,
    z: number,
): Promise<{ tx: number; ty: number; img: HTMLImageElement } | null> {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const key = `${z}-${x}-${y}`;

    if (tileCache.has(key)) {
        const img = tileCache.get(key);
        if (img) return { tx: x, ty: y, img };
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.addEventListener('load', () => {
            tileCache.set(key, img);
            resolve({ tx: x, ty: y, img });
        });
        img.addEventListener('error', () => {
            resolve(null);
        });
        img.src = url;
    });
}

function drawEndpoints(
    context: CanvasRenderingContext2D,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    poses: any[],
    transformX: (x: number) => number,
    transformY: (y: number) => number,
) {
    // Start Point (Green)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const start = poses[0].pose.position;
    context.fillStyle = '#4CAF50';
    context.beginPath();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    context.arc(transformX(start.x), transformY(start.y), 4, 0, Math.PI * 2);
    context.fill();

    // End Point (Red)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const end = poses.at(-1).pose.position;
    context.fillStyle = '#F44336';
    context.beginPath();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    context.arc(transformX(end.x), transformY(end.y), 4, 0, Math.PI * 2);
    context.fill();
}

async function copyRaw(): Promise<void> {
    if (!currentMessage.value) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    await quasarCopy(JSON.stringify(currentMessage.value.data, null, 2));
    Notify.create({
        message: 'Path data copied',
        color: 'positive',
        timeout: 1000,
    });
}
</script>

<style scoped>
.border-color {
    border: 1px solid #e0e0e0;
}
.canvas-container {
    height: 400px;
    width: 100%;
    border: 1px solid #ddd;
}
.path-canvas {
    width: 100%;
    height: 100%;
}
</style>
