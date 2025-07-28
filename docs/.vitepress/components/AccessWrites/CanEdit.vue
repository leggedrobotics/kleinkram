<template>
    <ClientOnly>
        <Hint :hint="props.hint" class="access-right-view">
            Can Edit</Hint
        >
    </ClientOnly>
</template>

<script setup lang="ts">
import Hint from '../Hint.vue';

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
