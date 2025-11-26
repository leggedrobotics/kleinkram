<template>
    <q-btn-dropdown
        v-model="open"
        :label="labelText"
        dense
        no-caps
        flat
        :ripple="false"
        class="full-width no-hover-effect"
        content-class="bg-white text-black shadow-3 rounded-borders"
        menu-anchor="bottom left"
        menu-self="top left"
        :menu-offset="[0, 4]"
        @hide="onHide"
    >
        <q-list style="width: 100%; min-width: 200px" padding>
            <q-item
                v-for="option in internalValue"
                :key="option.name"
                v-ripple
                clickable
                class="q-py-sm"
                @click.stop.prevent="() => onToggle(option.name)"
            >
                <q-item-section avatar style="min-width: 40px">
                    <q-checkbox
                        :model-value="option.value"
                        dense
                        color="primary"
                        class="no-pointer-events"
                    />
                </q-item-section>

                <q-item-section>
                    <q-item-label class="text-body2">
                        {{ option.name }}
                    </q-item-label>
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
        const newValue = v
            ? v.map((x) => ({ ...x }))
            : DEFAULT_OPTIONS.map((value) => ({ ...value }));

        if (JSON.stringify(newValue) !== JSON.stringify(internalValue.value)) {
            internalValue.value = newValue;
        }
    },
    { deep: true },
);

const selectedString = computed(() => {
    return internalValue.value
        .filter((item) => item.value)
        .map((item) => item.name)
        .join(', ');
});

const totalCount = computed(() => internalValue.value.length);
const selectedCount = computed(
    () => internalValue.value.filter((item) => item.value).length,
);

const labelText = computed(() => {
    if (selectedCount.value === 0) return `File Types: All`;
    if (selectedCount.value === totalCount.value) return `File Types: All`;
    if (selectedCount.value > 1) return `File Types: Many`;
    return `Type: ${selectedString.value}`;
});

function onToggle(name: string): void {
    internalValue.value = internalValue.value.map((it) =>
        it.name === name ? { ...it, value: !it.value } : { ...it },
    );
}

function onHide(): void {
    emit('update:modelValue', internalValue.value);
}

function setAll(value: boolean): void {
    const updated = internalValue.value.map((it) => ({ ...it, value }));
    internalValue.value = updated;
    emit('update:modelValue', updated);
}

defineExpose({ setAll });
</script>

<style scoped>
.no-hover-effect :deep(.q-focus-helper) {
    display: none !important;
}

.no-hover-effect {
    background: transparent !important;
}

.no-pointer-events {
    pointer-events: none;
}
</style>
