<template>
    <div style="margin-top: 32px">
        <span class="text-h5">Compute Resources</span>
        <div style="margin-top: 16px">
            <div class="q-mb-md">
                <label class="block q-mb-sm">Memory Allocation *</label>
                <div class="q-gutter-sm">
                    <resource-button
                        v-for="m in memoryOptions"
                        :key="m"
                        :label="`${m}GB`"
                        :is-selected="cpuMemory === m"
                        @click="() => updateCpuMemory(m)"
                    />
                </div>
                <ErrorMessage
                    :errors="errors"
                    field-path="actionResources.memoryOptions"
                />
            </div>
            <div class="q-mb-md">
                <label class="block q-mb-sm">CPU Core Allocation *</label>
                <div class="q-gutter-sm">
                    <resource-button
                        v-for="c in cpuOptions"
                        :key="c"
                        :label="`${c} Core${c > 1 ? 's' : ''}`"
                        :is-selected="cpuCores === c"
                        @click="() => updateCpuOption(c)"
                    />
                </div>
                <ErrorMessage
                    :errors="errors"
                    field-path="actionResources.cpuOptions"
                />
            </div>
            <div class="q-mb-md">
                <label class="block q-mb-sm">GPU Allocation *</label>
                <div class="q-gutter-sm">
                    <resource-button
                        v-for="g in gpuOptions"
                        :key="g.gpuModel"
                        :label="
                            g.gpuModel
                                ? `${g.gpuModel} (${g.gpuMemory}GB)`
                                : 'No GPU'
                        "
                        :is-selected="
                            gpu.useGPU == g.useGPU &&
                            gpu.gpuModel === g.gpuModel &&
                            gpu.gpuMemory === g.gpuMemory
                        "
                        @click="() => updateGpuModel(g)"
                    />
                    <ErrorMessage
                        :errors="errors"
                        field-path="actionResources.gpu"
                    />
                </div>
            </div>
            <div class="q-mb-md">
                <label class="block q-mb-sm" for="maxRuntimeInput">
                    Max Action Runtime (h) *
                </label>
                <q-input
                    v-model.number="maxRuntime"
                    name="maxRuntimeInput"
                    type="number"
                    style="max-width: 150px"
                    outlined
                    dense
                />
                <ErrorMessage
                    :errors="errors"
                    field-path="actionResources.maxRuntime"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import ErrorMessage from 'components/action-submission/settings/error-message.vue';
import ResourceButton from 'components/action-submission/settings/resource-button.vue';
import {
    ActionConfigurationValidationError,
    GpuModel,
} from 'components/action-submission/types';
import { defineModel, watch } from 'vue';

// --- Configuration ---
// TODO: query from backend
const memoryOptions = [1, 2, 4, 8, 12];
const cpuOptions = [1, 2, 4, 8];
const gpuOptions = [
    { useGPU: false, gpuModel: '', gpuMemory: 0 },
    { useGPU: true, gpuModel: 'NVIDIA Tesla K80', gpuMemory: 12 },
    { useGPU: true, gpuModel: 'NVIDIA Tesla V100', gpuMemory: 16 },
    { useGPU: true, gpuModel: 'NVIDIA A100', gpuMemory: 40 },
    { useGPU: true, gpuModel: 'NVIDIA A100', gpuMemory: 80 },
];

// --- Models ---
const cpuMemory = defineModel<number>('cpuMemory', { required: true });
const cpuCores = defineModel<number>('cpuCores', { required: true });
const gpu = defineModel<GpuModel>('gpu', { required: true });
const maxRuntime = defineModel<number>('maxRuntime', { required: true });
const errors = defineModel<ActionConfigurationValidationError[]>('errors', {
    required: true,
});

/// --- click handlers ---

const updateCpuMemory = (m: number): void => {
    cpuMemory.value = m;
};

const updateCpuOption = (c: number): void => {
    cpuCores.value = c;
};

const updateGpuModel = (g: GpuModel): void => {
    gpu.value = g;
};

/// --- Watchers ---
// to validate the input

watch(
    () => cpuMemory.value,
    () => {
        errors.value = errors.value.filter(
            (error) => error.fieldPath !== 'actionResources.memoryOptions',
        );
    },
);

watch(
    () => cpuCores.value,
    () => {
        errors.value = errors.value.filter(
            (error) => error.fieldPath !== 'actionResources.cpuOption',
        );
    },
);

watch(
    () => gpu.value,
    () => {
        errors.value = errors.value.filter(
            (error) => error.fieldPath !== 'actionResources.gpu',
        );
    },
);

watch(
    () => maxRuntime.value,
    (_maxRuntime) => {
        const newError = errors.value.filter(
            (error) => error.fieldPath !== 'actionResources.maxRuntime',
        );

        if (_maxRuntime < 1) {
            newError.push({
                fieldPath: 'actionResources.maxRuntime',
                errorMessage: 'Max runtime must be at least 1 hour',
            });
        }

        errors.value = newError;
    },
);
</script>
