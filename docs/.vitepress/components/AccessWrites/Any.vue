<template>
    <ClientOnly>
        <Hint :hint="props.hint" class="access-right-view">
            Any
        </Hint>
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
    background-color: #fff6d9;
    color: #585a1c;
}
</style>
