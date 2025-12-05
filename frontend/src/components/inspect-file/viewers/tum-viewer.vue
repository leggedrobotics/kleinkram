<template>
    <div class="tum-viewer">
        <div class="bg-white rounded-borders border-color q-pa-md">
            <div class="row justify-between items-center q-mb-md">
                <div class="row items-center q-gutter-x-sm">
                    <q-badge color="purple-1" text-color="purple-9">
                        <q-icon
                            name="sym_o_timeline"
                            size="xs"
                            class="q-mr-xs"
                        />
                        {{ poses.length }} Poses
                    </q-badge>
                    <div class="text-caption text-grey-7">
                        Duration: {{ duration.toFixed(2) }}s
                    </div>
                </div>
                <div class="row items-center q-gutter-x-sm">
                    <q-btn
                        icon="sym_o_content_copy"
                        flat
                        round
                        dense
                        size="sm"
                        color="grey-7"
                        @click="copyRaw"
                    >
                        <q-tooltip>Copy Content</q-tooltip>
                    </q-btn>
                </div>
            </div>

            <!-- Canvas Container -->
            <div
                ref="containerReference"
                class="canvas-container bg-grey-1 rounded-borders relative-position"
            >
                <canvas ref="canvasReference" class="path-canvas"></canvas>

                <div
                    v-if="poses.length === 0"
                    class="absolute-full flex flex-center text-grey-5"
                >
                    No Valid Trajectory Data
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Notify, copyToClipboard as quasarCopy } from 'quasar';
import { computed, onMounted, ref, watch } from 'vue';

const properties = defineProps<{
    content: string;
}>();

const containerReference = ref<HTMLElement | null>(null);
const canvasReference = ref<HTMLCanvasElement | null>(null);

interface Pose {
    timestamp: number;
    x: number;
    y: number;
    z: number;
    qx: number;
    qy: number;
    qz: number;
    qw: number;
}

// eslint-disable-next-line complexity
const poses = computed(() => {
    const lines = properties.content.split('\n');
    const parsed: Pose[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

        const parts = trimmed.split(/\s+/);
        if (parts.length < 8) continue;

        const timestamp = Number.parseFloat(parts[0] ?? '');
        const tx = Number.parseFloat(parts[1] ?? '');
        const ty = Number.parseFloat(parts[2] ?? '');
        const tz = Number.parseFloat(parts[3] ?? '');
        const qx = Number.parseFloat(parts[4] ?? '');
        const qy = Number.parseFloat(parts[5] ?? '');
        const qz = Number.parseFloat(parts[6] ?? '');
        const qw = Number.parseFloat(parts[7] ?? '');

        if (
            !Number.isNaN(timestamp) &&
            !Number.isNaN(tx) &&
            !Number.isNaN(ty) &&
            !Number.isNaN(tz) &&
            !Number.isNaN(qx) &&
            !Number.isNaN(qy) &&
            !Number.isNaN(qz) &&
            !Number.isNaN(qw)
        ) {
            parsed.push({
                timestamp,
                x: tx,
                y: ty,
                z: tz,
                qx,
                qy,
                qz,
                qw,
            });
        }
    }
    return parsed;
});

const duration = computed(() => {
    if (poses.value.length < 2) return 0;
    const first = poses.value[0];
    const last = poses.value.at(-1);
    if (!first || !last) return 0;
    return last.timestamp - first.timestamp;
});

onMounted(() => {
    if (containerReference.value) {
        const observer = new ResizeObserver(() => {
            renderPath();
        });
        observer.observe(containerReference.value);
    }
    renderPath();
});

watch(poses, () => {
    renderPath();
});

function renderPath() {
    const canvas = canvasReference.value;
    const container = containerReference.value;
    if (!canvas || !container) return;

    const data = poses.value;
    if (data.length === 0) {
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
    for (const p of data) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }

    renderLocalPath(
        context,
        data,
        minX,
        maxX,
        minY,
        maxY,
        canvas.width,
        canvas.height,
    );
}

function renderLocalPath(
    context: CanvasRenderingContext2D,
    data: Pose[],
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    width: number,
    height: number,
) {
    const padding = 40;
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
    context.stroke();

    // Path
    context.strokeStyle = '#2196F3';
    context.lineWidth = 2;
    context.beginPath();

    const transformX = (x: number) => x * scale + offsetX;
    const transformY = (y: number) => height - (y * scale + offsetY);

    for (const [index, p] of data.entries()) {
        const x = transformX(p.x);
        const y = transformY(p.y);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    }
    context.stroke();

    drawEndpoints(context, data, transformX, transformY);
}

function drawEndpoints(
    context: CanvasRenderingContext2D,
    data: Pose[],
    transformX: (x: number) => number,
    transformY: (y: number) => number,
) {
    if (data.length === 0) return;

    // Start Point (Green)
    const start = data[0];
    if (start) {
        context.fillStyle = '#4CAF50';
        context.beginPath();
        context.arc(
            transformX(start.x),
            transformY(start.y),
            4,
            0,
            Math.PI * 2,
        );
        context.fill();
    }

    // End Point (Red)
    const end = data.at(-1);
    if (end) {
        context.fillStyle = '#F44336';
        context.beginPath();
        context.arc(transformX(end.x), transformY(end.y), 4, 0, Math.PI * 2);
        context.fill();
    }
}

async function copyRaw(): Promise<void> {
    await quasarCopy(properties.content);
    Notify.create({
        message: 'Content copied',
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
