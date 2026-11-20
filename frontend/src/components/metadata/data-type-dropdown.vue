<template>
    <q-select
        v-model="selectedDataType"
        no-error-icon
        :options="dataTypeOptions"
        outlined
        dense
        color="button-primary"
        :error="error"
        :error-message="errorMessage"
    >
        <template #option="scope">
            <q-item v-bind="scope.itemProps">
                <q-item-section avatar class="data-type-option__icon">
                    <q-icon :name="icon(scope.opt)" size="20px" />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ dataTypeName(scope.opt) }}</q-item-label>
                </q-item-section>
            </q-item>
        </template>

        <template #selected-item="scope">
            <div v-if="scope.opt" class="row items-center no-wrap">
                <q-icon :name="icon(scope.opt)" size="20px" class="q-mr-sm" />
                <span>{{ dataTypeName(scope.opt) }}</span>
            </div>
        </template>
    </q-select>
</template>

<script setup lang="ts">
import { DataType } from '@kleinkram/shared';
import { icon } from 'src/services/generic';
import { computed } from 'vue';

const properties = defineProps<{
    modelValue: DataType | undefined;
    error?: boolean;
    errorMessage?: string;
}>();
const emit = defineEmits(['update:modelValue']);

const selectedDataType = computed({
    get: () => properties.modelValue,
    set: (value) => {
        emit('update:modelValue', value);
    },
});

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const error = computed(() => properties.error ?? false);
const errorMessage = computed(() => properties.errorMessage ?? '');

/** e.g. STRING -> String */
const dataTypeName = (dataType: string): string =>
    dataType.charAt(0) + dataType.slice(1).toLowerCase();

const dataTypeOptions = Object.keys(DataType).filter(
    (value) => (value as DataType) !== DataType.ANY,
);
</script>

<style scoped>
.data-type-option__icon {
    min-width: 0;
    padding-right: 12px;
}
</style>
