<template>
    <ClientOnly>
        <Hint :hint="props.hint" class="access-right-view">
            Creator</Hint
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
    background-color: #d9fff9;
    color: #1c5a4c;
}
</style>
