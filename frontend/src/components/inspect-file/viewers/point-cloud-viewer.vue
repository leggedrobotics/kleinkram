<template>
    <div class="point-cloud-viewer">
        <div class="bg-white rounded-borders border-color q-pa-md">
            <div class="row justify-between items-center q-mb-md">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="indigo-1" text-color="indigo-9">
                        {{ width }}x{{ height }} Points
                    </q-badge>
                    <div class="text-caption text-grey-7">
                        Frame: {{ frameId }}
                    </div>
                </div>
                <div class="row q-gutter-x-sm">
                    <q-btn
                        icon="sym_o_restart_alt"
                        flat
                        round
                        dense
                        size="sm"
                        color="grey-7"
                        @click="resetView"
                    >
                        <q-tooltip>Reset View</q-tooltip>
                    </q-btn>
                    <q-btn
                        icon="sym_o_content_copy"
                        flat
                        round
                        dense
                        size="sm"
                        color="grey-7"
                        @click="copyRaw"
                    >
                        <q-tooltip>Copy Metadata</q-tooltip>
                    </q-btn>
                </div>
            </div>

            <div
                class="canvas-wrapper bg-grey-9 rounded-borders flex flex-center relative-position overflow-hidden"
                @wheel.prevent="handleWheel"
                @mousedown="startDrag"
                @mousemove="onDrag"
                @mouseup="stopDrag"
                @mouseleave="stopDrag"
            >
                <canvas ref="canvasReference" class="pc-canvas" />

                <div
                    class="absolute-top-left q-pa-sm text-white text-caption no-pointer-events"
                >
                    <div>Top-Down View (XY Plane)</div>
                    <div class="text-grey-5">Color: Z-Height</div>
                </div>

                <div class="absolute-bottom-right q-pa-md column q-gutter-y-sm">
                    <q-btn
                        round
                        color="grey-8"
                        text-color="white"
                        icon="sym_o_add"
                        size="sm"
                        @click="zoomIn"
                    />
                    <q-btn
                        round
                        color="grey-8"
                        text-color="white"
                        icon="sym_o_remove"
                        size="sm"
                        @click="zoomOut"
                    />
                </div>

                <div
                    class="absolute-top-right q-pa-sm text-grey-5 text-caption no-pointer-events"
                >
                    {{ (userZoom * 100).toFixed(0) }}%
                </div>
            </div>

            <div class="row justify-between items-center q-mt-md">
                <div class="text-caption text-grey-7">
                    Message {{ currentIndex + 1 }} of {{ messages.length }}
                </div>
                <div class="row q-gutter-sm">
                    <q-btn
                        round
                        flat
                        dense
                        icon="sym_o_skip_previous"
                        :disable="currentIndex <= 0"
                        @click="decrementIndex"
                    />
                    <q-btn
                        round
                        flat
                        dense
                        icon="sym_o_skip_next"
                        :disable="currentIndex >= messages.length - 1"
                        @click="incrementIndex"
                    />
                </div>
            </div>

            <div
                v-if="messages.length < totalCount"
                class="text-center q-mt-sm"
            >
                <q-btn
                    label="Load More Scans"
                    icon="sym_o_download"
                    size="sm"
                    flat
                    color="primary"
                    @click="loadMore"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { computed, onMounted, ref, watch } from 'vue';

const properties = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[];
    totalCount: number;
    topicName: string;
}>();

const emit = defineEmits(['load-required', 'load-more']);
const canvasReference = ref<HTMLCanvasElement | null>(null);
const currentIndex = ref(0);

const incrementIndex = (): void => {
    if (currentIndex.value < properties.messages.length - 1) {
        currentIndex.value++;
    }
};

const decrementIndex = (): void => {
    if (currentIndex.value > 0) {
        currentIndex.value--;
    }
};

// --- Interaction State ---
const userZoom = ref(1);
const userPan = ref({ x: 0, y: 0 });
const isDragging = ref(false);
const lastMouse = ref({ x: 0, y: 0 });

// --- Computed Data Access ---
const currentMessage = computed(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    () => properties.messages[currentIndex.value] ?? null,
);
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
const width = computed(() => currentMessage.value?.data?.width ?? 0);
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
const height = computed(() => currentMessage.value?.data?.height ?? 0);
const frameId = computed(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    () => currentMessage.value?.data?.header?.frame_id ?? '',
);

onMounted(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!properties.messages || properties.messages.length === 0) {
        emit('load-required');
    } else {
        renderCloud();
    }
});

watch(currentIndex, renderCloud);
watch(
    () => properties.messages.length,
    () => {
        if (currentIndex.value >= properties.messages.length)
            currentIndex.value = 0;
        renderCloud();
    },
);

// --- Interaction Logic ---

function resetView(): void {
    userZoom.value = 1;
    userPan.value = { x: 0, y: 0 };
    renderCloud();
}

function zoomIn(): void {
    userZoom.value *= 1.2;
    renderCloud();
}

function zoomOut(): void {
    userZoom.value /= 1.2;
    renderCloud();
}

function handleWheel(event: WheelEvent): void {
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    userZoom.value *= delta;
    renderCloud();
}

function startDrag(event: MouseEvent): void {
    isDragging.value = true;
    lastMouse.value = { x: event.clientX, y: event.clientY };
}

function onDrag(event: MouseEvent): void {
    if (!isDragging.value) return;
    const dx = event.clientX - lastMouse.value.x;
    const dy = event.clientY - lastMouse.value.y;

    userPan.value.x += dx;
    userPan.value.y += dy;

    lastMouse.value = { x: event.clientX, y: event.clientY };
    renderCloud();
}

function stopDrag(): void {
    isDragging.value = false;
}

// --- Parsing Logic ---
interface Point {
    x: number;
    y: number;
    z: number;
}

const renderError = ref<string | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePoints(message: any): Point[] {
    renderError.value = null;
    if (!message) return [];

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const fields = message.fields as any[];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!fields || !Array.isArray(fields)) {
            throw new Error('Message missing "fields" array');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const data = message.data as Uint8Array | number[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const pointStep = message.point_step as number;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const isBigEndian = message.is_bigendian;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const totalPoints = message.width * message.height;

        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        const view = new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength,
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const xField = fields.find((f: any) => f.name === 'x');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const yField = fields.find((f: any) => f.name === 'y');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const zField = fields.find((f: any) => f.name === 'z');

        if (!xField || !yField) {
            throw new Error('Missing x or y fields in PointCloud2');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const xOff: number = xField.offset;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const yOff: number = yField.offset;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const zOff: number = zField ? zField.offset : -1;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const isFloat32 = xField.datatype === 7;

        const points: Point[] = [];

        for (let index = 0; index < totalPoints; index++) {
            const base = index * pointStep;
            if (base + pointStep > bytes.length) break;

            let x,
                y,
                z = 0;
            if (isFloat32) {
                x = view.getFloat32(base + xOff, !isBigEndian);
                y = view.getFloat32(base + yOff, !isBigEndian);
                if (zOff >= 0) z = view.getFloat32(base + zOff, !isBigEndian);
            } else {
                x = view.getFloat64(base + xOff, !isBigEndian);
                y = view.getFloat64(base + yOff, !isBigEndian);
                if (zOff >= 0) z = view.getFloat64(base + zOff, !isBigEndian);
            }

            if (
                !Number.isFinite(x) ||
                !Number.isFinite(y) ||
                !Number.isFinite(z)
            )
                continue;
            points.push({ x, y, z });
        }
        return points;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('Error parsing PointCloud2:', error);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        renderError.value = error.message;
        return [];
    }
}

// --- Rendering Logic ---
// --- Rendering Logic ---

// eslint-disable-next-line complexity
function renderCloud() {
    const canvas = canvasReference.value;
    if (!canvas || !currentMessage.value) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const points = parsePoints(currentMessage.value.data);
    if (points.length === 0) return;

    // Use parent container dimensions or window-based max
    // For now, let's set it to a reasonable large size or dynamic
    // But to fill the area, we need to know the container size.
    // Let's rely on the canvas's clientWidth/Height after CSS layout.

    // We need to set the internal resolution to match display size for sharpness
    // or keep it fixed. Let's try to match display size.
    const displayWidth = canvas.clientWidth || 800;
    const displayHeight = canvas.clientHeight || 600;

    // Update resolution if changed
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const context = canvas.getContext('2d');
    if (!context) return;

    // 1. Calculate Auto-Fit Bounds
    let minX = Infinity,
        maxX = -Infinity;
    let minY = Infinity,
        maxY = -Infinity;
    let minZ = Infinity,
        maxZ = -Infinity;

    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
    }

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const rangeZ = maxZ - minZ || 1;

    // Base Scale (Auto-Fit)
    // Fit to the smallest dimension
    const scaleX = (canvasWidth - 40) / rangeX;
    const scaleY = (canvasHeight - 40) / rangeY;
    const baseScale = Math.min(scaleX, scaleY);

    // Apply User Zoom
    const finalScale = baseScale * userZoom.value;

    // Calculate Center Offset + User Pan
    const contentWidth = rangeX * finalScale;
    const contentHeight = rangeY * finalScale;

    // Center logic: (Canvas - Content) / 2
    // We subtract minX * scale to shift the local 0,0 to the start of the data
    const offsetX =
        (canvasWidth - contentWidth) / 2 - minX * finalScale + userPan.value.x;

    // Y is inverted (Top-Down Map). Standard is Up=Y. Canvas is Down=Y.
    // We anchor to the bottom of the content area to flip it correctly?
    // Let's use standard flip logic: canvas_y = H - (world_y * scale + off_y)
    // Wait, if we center it, we just need to flip the Y coordinate relative to the center.
    // Let's stick to the previous logic but with dynamic height.
    const offsetY =
        (canvasHeight - contentHeight) / 2 -
        minY * finalScale -
        userPan.value.y;

    // 2. Draw
    const imgData = context.createImageData(canvasWidth, canvasHeight);
    const data = imgData.data;

    for (const p of points) {
        const cx = Math.floor(p.x * finalScale + offsetX);
        const cy = Math.floor(canvasHeight - (p.y * finalScale + offsetY));

        if (cx >= 0 && cx < canvasWidth && cy >= 0 && cy < canvasHeight) {
            const index = (cy * canvasWidth + cx) * 4;

            // Z-Coloring
            const zn = (p.z - minZ) / rangeZ;
            const r = Math.floor(zn * 255);
            const b = Math.floor((1 - zn) * 255);
            const g = 50;

            data[index] = r;
            data[index + 1] = g;
            data[index + 2] = b;
            data[index + 3] = 255;
        }
    }

    context.putImageData(imgData, 0, 0);

    // Draw Crosshair (0,0)
    context.strokeStyle = '#FFFFFF';
    context.lineWidth = 1;
    context.globalAlpha = 0.3;

    const originX = Math.floor(0 * finalScale + offsetX);
    const originY = Math.floor(canvasHeight - (0 * finalScale + offsetY));

    if (originX >= 0 && originX <= canvasWidth) {
        context.beginPath();
        context.moveTo(originX, 0);
        context.lineTo(originX, canvasHeight);
        context.stroke();
    }
    if (originY >= 0 && originY <= canvasHeight) {
        context.beginPath();
        context.moveTo(0, originY);
        context.lineTo(canvasWidth, originY);
        context.stroke();
    }
}

async function copyRaw(): Promise<void> {
    if (!currentMessage.value) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const meta = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ...currentMessage.value.data,
        data: '[Binary Blob Omitted]',
    };
    await quasarCopy(JSON.stringify(meta, null, 2));
    Notify.create({
        message: 'Metadata copied',
        color: 'positive',
        timeout: 1000,
    });
}

const loadMore = (): void => {
    emit('load-more');
};
</script>

<style scoped>
.border-color {
    border: 1px solid #e0e0e0;
}
.pc-canvas {
    width: 100%;
    height: 100%;
    /* max-width: 600px; */
    /* max-height: 600px; */
    image-rendering: pixelated;
    cursor: move; /* Indicate draggable */
}
.no-pointer-events {
    pointer-events: none;
}
</style>
