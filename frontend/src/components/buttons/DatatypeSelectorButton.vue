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
                @click="select(value)"
            >
                <q-item-section>
                    <q-item-label v-html="datatype" />
                </q-item-section>
                <q-item-section side>
                    <q-icon :name="icon(datatype)" size="sm" />
                </q-item-section>
            </q-item>
        </q-list>
    </q-btn-dropdown>
</template>

<script setup lang="ts">
import { ref, watch, PropType } from 'vue';
import { icon } from 'src/services/generic';
import { DataType } from '@common/enum';

// Define the props and emits for the component
const props = defineProps({
    modelValue: {
        type: String as PropType<DataType>,
        required: false,
        default: null,
    },
});

const emits = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const selectedLabel = ref<string | null>(null);

// Watch the modelValue prop to keep selectedLabel in sync
watch(
    () => props.modelValue,
    (newVal) => {
        selectedLabel.value = newVal;
    },
    { immediate: true },
);

function select(type: DataType) {
    selectedLabel.value = type;
    isOpen.value = false;
    emits('update:modelValue', type);
}
</script>

<style scoped></style>
