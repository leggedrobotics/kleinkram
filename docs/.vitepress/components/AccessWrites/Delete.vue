<template>
    <ClientOnly>
        <AccessRight :hint="props.hint" class="access-right-view">
            Delete</AccessRight
        >
    </ClientOnly>
</template>

<script setup lang="ts">
import AccessRight from './AccessRight.vue';

const props = defineProps<{
    hint?: string;
}>();
</script>

<style scoped>
@import 'access-badge.css';
.access-right-view {
    background-color: #ffb2b2;
    color: #9f0606;
}
</style>
