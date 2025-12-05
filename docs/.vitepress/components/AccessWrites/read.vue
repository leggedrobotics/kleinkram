<!-- eslint-disable vue/multi-word-component-names -->
// eslint-disable-next-line vue/multi-word-component-names
// eslint-disable-next-line unicorn/filename-case
// eslint-disable-next-line vue/multi-word-component-names
// eslint-disable-next-line unicorn/filename-case
<template>
    <ClientOnly>
        <Hint :hint="props.hint" class="access-right-view">
            Read
        </Hint>
    </ClientOnly>
</template>

<script setup lang="ts">
import Hint from '../hint.vue';

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
