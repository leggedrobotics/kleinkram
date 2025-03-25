<template>
    <q-select
        v-model="selectedDataType"
        :options="dataTypeOptions"
        outlined
        dense
        required
        :error="error"
        :error-message="errorMessage"
        option-label="label"
        option-value="value"
    >
        <span
            v-if="selectedDataType === undefined"
            class="text-placeholder absolute"
            style="line-height: 40px"
        >
            e.g., String
        </span>

        <template #option="scope">
            <q-item v-bind="scope.itemProps">
                <q-item-section>
                    <q-item-label>
                        <q-chip square>{{ scope.opt.label }}</q-chip>
                    </q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-icon :name="icon(scope.opt.value)" class="q-mr-sm" />
                </q-item-section>
            </q-item>
        </template>

        <template #selected-item="scope">
            <div class="row items-center">
                <span v-if="scope.opt">{{ scope.opt.label }}</span>
                <span
                    v-else-if="!scope.opt || !scope.opt.label"
                    class="text-grey"
                >
                    Data Type (e.g., String)
                </span>
                <q-icon
                    v-if="scope.opt"
                    :name="icon(scope.opt.value)"
                    class="q-ml-sm"
                />
            </div>
        </template>
    </q-select>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DataType } from '@common/enum';
import { icon } from '../../services/generic';

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

const error = computed(() => properties.error ?? false);
const errorMessage = computed(() => properties.errorMessage ?? '');

const dataTypeOptions = Object.entries(DataType)
    .filter(([_, value]) => value !== DataType.ANY) // eslint-disable-line @typescript-eslint/no-unused-vars
    .map(([label, value]) => ({ label, value }));
</script>
