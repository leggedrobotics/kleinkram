<template>
    <q-btn-dropdown
        v-model="isOpen"
        :label="selectedLabel || 'Data Type'"
        clearable
        unelevated
        outline
        required
        style="width: 100%; min-width: 60px"
    >
        <q-list>
            <q-item
                v-for="[datatype, value] in Object.entries(DataType)"
                :key="datatype"
                clickable
                @click="() => select(value)"
            >
                <q-item-section>
                    <q-item-label v-html="datatype" />
                </q-item-section>
                <q-item-section side>
                    <q-icon
                        :name="
                            // @ts-ignore
                            icon(datatype)
                        "
                        size="sm"
                    />
                </q-item-section>
            </q-item>
        </q-list>
    </q-btn-dropdown>
</template>

<script setup lang="ts">
import { DataType } from '@common/enum';
import { icon } from 'src/services/generic';
import { ref, watch } from 'vue';

// Define the props and emits for the component
const { modelValue } = defineProps<{
    modelValue: DataType;
}>();

const emits = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const selectedLabel = ref<string | null>(null);

// Watch the modelValue prop to keep selectedLabel in sync
watch(
    () => modelValue,
    (newValue) => {
        selectedLabel.value = newValue;
    },
    { immediate: true },
);

const select = (type: DataType): void => {
    selectedLabel.value = type;
    isOpen.value = false;
    emits('update:modelValue', type);
};
</script>

<style scoped></style>
