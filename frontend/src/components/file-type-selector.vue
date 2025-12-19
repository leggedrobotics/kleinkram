<template>
    <SelectionButtonGroup
        :options="options"
        :model-value="selectedKeys"
        type="multi"
        @update:model-value="onSelectionUpdate"
    />
</template>

<script setup lang="ts">
import { FileType } from '@kleinkram/shared';
import SelectionButtonGroup from 'components/common/selection-button-group.vue';
import { FileTypeOption } from 'src/types/file-type-option';
import { computed, ref, watch } from 'vue';

const properties = defineProps<{
    modelValue?: FileTypeOption[] | undefined;
}>();

const emit =
    defineEmits<
        (event: 'update:modelValue', value: FileTypeOption[]) => void
    >();

const DEFAULT_OPTIONS: FileTypeOption[] = Object.values(FileType)
    .filter((fileType) => fileType !== FileType.ALL)
    .map((fileType) => ({
        name: fileType,
        value: true,
    }));

// Internal copy
const internalValue = ref<FileTypeOption[]>(
    properties.modelValue
        ? properties.modelValue.map((v) => ({ ...v }))
        : DEFAULT_OPTIONS.map((v) => ({ ...v })),
);

if (properties.modelValue === undefined) {
    emit('update:modelValue', internalValue.value);
}

watch(
    () => properties.modelValue,
    (v) => {
        const newValue = v
            ? v.map((x) => ({ ...x }))
            : DEFAULT_OPTIONS.map((value) => ({ ...value }));
        if (JSON.stringify(newValue) !== JSON.stringify(internalValue.value)) {
            internalValue.value = newValue;
        }
    },
    { deep: true },
);

// Compute options for the button group
const options = computed(() => {
    // Add 'All' option at the start
    const optionsList = internalValue.value.map((opt) => ({
        label: opt.name,
        value: opt.name,
    }));
    return [{ label: 'All', value: 'ALL', special: true }, ...optionsList];
});

// Compute currently selected keys (strings)
const selectedKeys = computed(() => {
    const selected = internalValue.value
        .filter((item) => item.value)
        .map((item) => item.name);

    // Check if ALL are selected
    if (selected.length === internalValue.value.length) {
        return ['ALL', ...selected];
    }
    return selected;
});

function onSelectionUpdate(newKeys: string | string[]) {
    const keys = Array.isArray(newKeys) ? newKeys : [newKeys];

    const updated =
        keys.length === 1 && keys[0] === 'ALL'
            ? internalValue.value.map((it) => ({ ...it, value: true }))
            : internalValue.value.map((it) => ({
                  ...it,
                  value: keys.includes(it.name),
              }));

    internalValue.value = updated;
    emit('update:modelValue', updated);
}

function setAll(value: boolean): void {
    const updated = internalValue.value.map((it) => ({ ...it, value }));
    internalValue.value = updated;
    emit('update:modelValue', updated);
}

defineExpose({ setAll });
</script>
