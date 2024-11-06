<template>
    <ClientOnly>
        <Hint :hint="props.hint" class="access-right-view">
            Modify</Hint
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
    background-color: #e5c1f3;
    color: #5f2361;
}
</style>
