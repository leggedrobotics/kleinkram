<template>
    <AccessRight :hint="props.hint" class="access-right-view">
        Read</AccessRight
    >
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
    background-color: #c6f3c1;
    color: #276123;
}
</style>
