<!-- eslint-disable vue/multi-word-component-names -->
// eslint-disable-next-line vue/multi-word-component-names
// eslint-disable-next-line unicorn/filename-case
// eslint-disable-next-line vue/multi-word-component-names
// eslint-disable-next-line unicorn/filename-case
<template>
    <div
        class="access-badge table-cell"
        @mouseover="showTooltip"
        @mouseleave="hideTooltip"
    >
        <slot name="default" />
        {{ hint ? '*' : '' }}
        <div
            v-if="tooltipVisible && !!hint"
            class="tooltip"
            style="width: 200px; white-space: normal; overflow-wrap: break-word"
        >
            {{ hint }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const props = defineProps<{
    hint?: string;
}>();

const tooltipVisible = ref(false);

const showTooltip = () => {
    tooltipVisible.value = true;
};

const hideTooltip = () => {
    tooltipVisible.value = false;
};
</script>

<style scoped>
@import 'AccessWrites/access-badge.css';

.tooltip {
    position: absolute;
    background-color: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    outline: var(--vp-c-divider) solid 1px;
    padding: 5px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
    white-space: nowrap;
    top: -5px; /* Adjusted to position above the element */
    left: 50%;
    transform: translateX(-50%) translateY(-100%); /* Adjusted to place above element */
    pointer-events: none; /* Ensures it doesn't interfere with clicking */
}

.table-cell {
    position: relative; /* Make sure the parent is relatively positioned */
    display: inline-block;
}
</style>
