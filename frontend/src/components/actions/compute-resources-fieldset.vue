<template>
    <div>
        <span class="text-h5">Compute Resources</span>
        <div class="row q-col-gutter-md q-mt-xs">
            <div class="col-6">
                <AppInput
                    v-model.number="model.cpuMemory"
                    label="Memory (GB)"
                    type="number"
                    :readonly="readonly"
                    :required="!readonly"
                    :rules="[(val) => val != null || 'Memory is required']"
                >
                    <template v-if="readonly" #default>
                        <q-tooltip>Requires new version to change</q-tooltip>
                    </template>
                </AppInput>
            </div>

            <div class="col-6">
                <AppInput
                    v-model.number="model.cpuCores"
                    label="CPU Cores"
                    type="number"
                    :readonly="readonly"
                    :required="!readonly"
                    :rules="[(val) => val != null || 'Cores is required']"
                >
                    <template v-if="readonly" #default>
                        <q-tooltip>Requires new version to change</q-tooltip>
                    </template>
                </AppInput>
            </div>

            <div class="col-6">
                <AppInput
                    v-model.number="model.maxRuntime"
                    label="Max Runtime (h)"
                    type="number"
                    :readonly="readonly"
                    :required="!readonly"
                    :rules="[(val) => val != null || 'Runtime is required']"
                >
                    <template v-if="readonly" #default>
                        <q-tooltip>Requires new version to change</q-tooltip>
                    </template>
                </AppInput>
            </div>

            <div v-if="!readonly" class="col-12 flex items-center q-mt-sm">
                <q-toggle
                    v-model="gpuEnabled"
                    label="Enable GPU Acceleration"
                />
            </div>

            <div v-if="readonly" class="col-6">
                <AppInput
                    :model-value="hasGpu ? 'Enabled' : 'Disabled'"
                    label="GPU Support"
                    readonly
                />
            </div>

            <div v-if="hasGpu || (!readonly && gpuEnabled)" class="col-6">
                <AppInput
                    v-model.number="model.gpuMemory"
                    label="GPU Memory (GB)"
                    type="number"
                    :readonly="readonly"
                    :required="!readonly"
                    :rules="[(val) => val > 0 || 'GPU Memory must be positive']"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import AppInput from 'components/common/app-input.vue';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    readonly?: boolean;
}>();

const model = defineModel<{
    cpuCores: number;
    cpuMemory: number;
    maxRuntime: number;
    gpuMemory: number;
}>({ required: true });

const hasGpu = computed(() => (model.value.gpuMemory ?? -1) > -1);
const gpuEnabled = ref(hasGpu.value);

// Sync toggle changes to model
watch(gpuEnabled, (enabled) => {
    if (!props.readonly) {
        if (!enabled) model.value.gpuMemory = -1;
        else if (model.value.gpuMemory === -1) model.value.gpuMemory = 6;
    }
});
</script>
