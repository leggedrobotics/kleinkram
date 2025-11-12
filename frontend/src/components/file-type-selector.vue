<template>
    <q-btn-dropdown
        v-model="open"
        :label="labelText"
        dense
        clearable
        flat
        class="full-width full-height button-border"
    >
        <q-list style="width: 100%">
            <q-item v-for="option in internalValue" :key="option.name">
                <q-item-section class="items-center">
                    <q-toggle
                        dense
                        :model-value="option.value"
                        :label="option.name"
                        @click.stop.prevent="() => onToggle(option.name)"
                    />
                </q-item-section>
            </q-item>
        </q-list>
    </q-btn-dropdown>
</template>

<script setup lang="ts">
import { FileType } from '@common/enum';
import { computed, ref, watch } from 'vue';

export interface FileTypeOption {
    name: string;
    value: boolean;
}

const properties = defineProps<{
    modelValue?: FileTypeOption[] | undefined;
}>();

const emit =
    defineEmits<
        (event: 'update:modelValue', value: FileTypeOption[]) => void
    >();

const open = ref(false);

const DEFAULT_OPTIONS: FileTypeOption[] = Object.values(FileType)
    .filter((fileType) => fileType !== FileType.ALL)
    .map((fileType) => ({
        name: fileType,
        value: true,
    }));

// Internal copy to avoid mutating prop directly
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
        internalValue.value = v ? v.map((x) => ({ ...x })) : [];
    },
    { deep: true },
);

const selectedString = computed(() => {
    return internalValue.value
        .filter((item) => item.value)
        .map((item) => item.name)
        .join(' & ');
});

const totalCount = computed(() => internalValue.value.length);
const selectedCount = computed(
    () => internalValue.value.filter((item) => item.value).length,
);

const labelText = computed(() => {
    const prefix = 'File Types:';

    // If nothing selected, keep original 'All' behavior
    if (selectedCount.value === 0) return `${prefix} All`;
    // If all selected -> show ALL
    if (selectedCount.value === totalCount.value) return `${prefix} ALL`;
    // If more than 3 selected -> show MANY
    if (selectedCount.value > 2) return `${prefix} MANY`;
    // Otherwise show the joined names
    return `${prefix} ${selectedString.value}`;
});

function onToggle(name: string): void {
    const updated = internalValue.value.map((it) =>
        it.name === name ? { ...it, value: !it.value } : { ...it },
    );
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
