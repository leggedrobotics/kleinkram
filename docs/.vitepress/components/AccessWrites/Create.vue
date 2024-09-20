<template>
    <ClientOnly>
        <AccessRight :hint="props.hint" class="access-right-view">
            Create</AccessRight
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
    background-color: #c3d8fd;
    color: #1c275a;
}
</style>
