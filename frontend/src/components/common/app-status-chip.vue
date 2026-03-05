<template>
    <q-chip
        :color="isActive ? 'positive' : 'negative'"
        text-color="white"
        dense
        class="text-weight-bold q-px-sm"
        size="sm"
    >
        {{ isActive ? 'Active' : 'Expired' }}
    </q-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    expirationDate?: string | Date | null | undefined;
}>();

const isActive = computed(() => {
    if (!props.expirationDate) {
        return true;
    }
    return new Date(props.expirationDate) >= new Date();
});
</script>
