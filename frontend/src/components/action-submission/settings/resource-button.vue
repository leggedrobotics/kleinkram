<template>
    <q-btn
        :label="label"
        :color="isSelected ? 'blue' : 'grey-6'"
        :outline="!isSelected"
        unelevated
        @click="onClick"
    />
</template>

<script setup lang="ts">
import { defineEmits, defineProps } from 'vue';

defineProps({
    label: {
        type: String,
        required: true,
    },
    isSelected: {
        type: Boolean,
        default: false,
    },
});

const emits = defineEmits(['click']);
const onClick = (): void => emits('click');
</script>
