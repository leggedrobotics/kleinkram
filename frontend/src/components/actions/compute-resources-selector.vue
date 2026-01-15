<template>
    <div class="column q-gutter-y-md">
        <!-- Preset Cards -->
        <div class="row q-gutter-md">
            <q-card
                v-for="preset in PRESETS"
                :key="preset.name"
                v-ripple
                flat
                bordered
                class="col cursor-pointer transition-all"
                :class="{
                    'bg-button-primary text-white':
                        selectedPreset === preset.name,
                    'bg-white text-grey-9': selectedPreset !== preset.name,
                }"
                @click="() => applyPreset(preset)"
            >
                <q-card-section class="column items-center q-pa-md">
                    <div
                        class="letter-icon row flex-center q-mb-sm text-h6 text-weight-bold"
                        :class="
                            selectedPreset === preset.name
                                ? 'letter-icon-selected'
                                : 'letter-icon-unselected'
                        "
                    >
                        <template v-if="preset.letter">
                            {{ preset.letter }}
                        </template>
                        <q-icon v-else :name="preset.icon" size="1.5rem" />
                    </div>
                    <div class="text-subtitle1 text-weight-bold">
                        {{ preset.name }}
                    </div>
                    <div
                        class="text-caption text-center"
                        :class="
                            selectedPreset === preset.name
                                ? 'text-white'
                                : 'text-grey-7'
                        "
                    >
                        {{ preset.summary }}
                    </div>
                </q-card-section>
            </q-card>

            <!-- Custom Card -->
            <q-card
                v-ripple
                flat
                bordered
                class="col cursor-pointer transition-all"
                :class="{
                    'bg-button-primary text-white': selectedPreset === 'Custom',
                    'bg-white text-grey-9': selectedPreset !== 'Custom',
                }"
                @click="selectCustomPreset"
            >
                <q-card-section class="column items-center q-pa-md">
                    <q-icon
                        name="sym_o_tune"
                        size="2rem"
                        class="q-mb-sm"
                        :class="
                            selectedPreset === 'Custom'
                                ? 'text-white'
                                : 'text-link-primary'
                        "
                    />
                    <div class="text-subtitle1 text-weight-bold">Custom</div>
                    <div
                        class="text-caption text-center"
                        :class="
                            selectedPreset === 'Custom'
                                ? 'text-white'
                                : 'text-grey-7'
                        "
                    >
                        Define manually
                    </div>
                </q-card-section>
            </q-card>
        </div>

        <!-- Custom / Details Input -->
        <div
            v-if="selectedPreset === 'Custom'"
            class="row q-col-gutter-md q-mt-xs"
        >
            <div class="col-6">
                <label>
                    Memory (GB) <span class="text-negative">*</span>
                </label>
                <q-input
                    :model-value="cpuMemory"
                    type="number"
                    outlined
                    dense
                    lazy-rules
                    :rules="[
                        (val) =>
                            (val !== null && val !== '') ||
                            'Memory is required',
                    ]"
                    @update:model-value="updateCpuMemory"
                />
            </div>
            <div class="col-6">
                <label> CPU Cores <span class="text-negative">*</span> </label>
                <q-input
                    :model-value="cpuCores"
                    type="number"
                    outlined
                    dense
                    lazy-rules
                    :rules="[
                        (val) =>
                            (val !== null && val !== '') ||
                            'CPU Cores is required',
                    ]"
                    @update:model-value="updateCpuCores"
                />
            </div>
            <div class="col-6">
                <label>
                    Max Runtime (h) <span class="text-negative">*</span>
                </label>
                <q-input
                    :model-value="maxRuntime"
                    type="number"
                    outlined
                    dense
                    lazy-rules
                    :rules="[
                        (val) =>
                            (val !== null && val !== '') ||
                            'Runtime is required',
                    ]"
                    @update:model-value="updateMaxRuntime"
                />
            </div>

            <div class="col-12 flex items-center q-mt-sm">
                <q-toggle
                    :model-value="isGpuEnabled"
                    label="Enable GPU Acceleration"
                    @update:model-value="toggleGpu"
                />
            </div>

            <div v-if="isGpuEnabled" class="col-6">
                <label>
                    GPU Memory (GB) <span class="text-negative">*</span>
                </label>
                <q-input
                    :model-value="gpuMemory > 0 ? gpuMemory : 6"
                    type="number"
                    outlined
                    dense
                    lazy-rules
                    :rules="[(val) => val > 0 || 'GPU Memory must be positive']"
                    @update:model-value="updateGpuMemory"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    cpuCores: number;
    cpuMemory: number;
    gpuMemory: number;
    maxRuntime: number;
}>();

const emits =
    defineEmits<
        (
            event:
                | 'update:cpuCores'
                | 'update:cpuMemory'
                | 'update:gpuMemory'
                | 'update:maxRuntime',
            value: number,
        ) => void
    >();

const isGpuEnabled = computed(() => props.gpuMemory > -1);

interface Preset {
    name: string;
    icon: string;
    letter?: string;
    summary: string;
    cpuCores: number;
    cpuMemory: number;
    gpuMemory: number;
    // We don't strictly enforce runtime in presets, but can define defaults
}

const PRESETS: Preset[] = [
    {
        name: 'Small',
        icon: '',
        letter: 'S',
        summary: '1\u00A0CPU • 2GB\u00A0RAM',
        cpuCores: 1,
        cpuMemory: 2,
        gpuMemory: -1,
    },
    {
        name: 'Medium',
        icon: '',
        letter: 'M',
        summary: '2\u00A0CPU • 4GB\u00A0RAM',
        cpuCores: 2,
        cpuMemory: 4,
        gpuMemory: -1,
    },
    {
        name: 'Large',
        icon: '',
        letter: 'L',
        summary: '4\u00A0CPU • 8GB\u00A0RAM',
        cpuCores: 4,
        cpuMemory: 8,
        gpuMemory: -1,
    },
    {
        name: 'GPU',
        icon: 'sym_o_grid_view',
        summary: '4\u00A0CPU • 12GB\u00A0RAM • GPU',
        cpuCores: 4,
        cpuMemory: 12,
        gpuMemory: 6,
    },
];

const selectedPreset = ref<string | null>(null);

// Determine preset on mount / prop change
watch(
    () => [props.cpuCores, props.cpuMemory, props.gpuMemory],
    ([cores, mem, gpu]) => {
        const gpuValue = gpu ?? -1;
        const match = PRESETS.find(
            (p) =>
                p.cpuCores === cores &&
                p.cpuMemory === mem &&
                ((p.gpuMemory === -1 && gpuValue === -1) ||
                    (p.gpuMemory > -1 && gpuValue > -1)),
        );

        // If we are already on Custom, stay on Custom unless we are initializing
        if (selectedPreset.value === 'Custom') {
            return;
        }

        selectedPreset.value = match ? match.name : 'Custom';
    },
    { immediate: true },
);

function applyPreset(preset: Preset) {
    emits('update:cpuCores', preset.cpuCores);
    emits('update:cpuMemory', preset.cpuMemory);
    emits('update:gpuMemory', preset.gpuMemory);
    // Presets don't enforce maxRuntime, falling back to default
    selectedPreset.value = preset.name;
}

function selectCustomPreset() {
    selectedPreset.value = 'Custom';
}

function updateCpuCores(value: number | string | null) {
    emits('update:cpuCores', Number(value));
}

function updateCpuMemory(value: number | string | null) {
    emits('update:cpuMemory', Number(value));
}

function updateMaxRuntime(value: number | string | null) {
    emits('update:maxRuntime', Number(value));
}

function toggleGpu(value: boolean) {
    if (value) {
        emits('update:gpuMemory', 6);
    } else {
        emits('update:gpuMemory', -1);
    }
}

function updateGpuMemory(value: number | string | null) {
    emits('update:gpuMemory', Number(value));
}
</script>

<style scoped>
.transition-all {
    transition: all 0.2s ease-in-out;
}

.letter-icon {
    width: 2rem;
    height: 2rem;
    border: 2px solid currentColor;
    border-radius: 6px; /* Slightly rounded corners */
}

/* When the card is selected (bg-button-primary), the text/border should be white */
.letter-icon-selected {
    color: white;
    border-color: white;
}

/* When unselected, match the icon color (link-primary) */
.letter-icon-unselected {
    color: var(--q-primary); /* Fallback? No, should be link-primary color */
    color: #0f62fe; /* $link-primary from variables */
    border-color: #0f62fe;
}
</style>
