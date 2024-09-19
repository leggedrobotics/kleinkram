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
@import 'access-badge.css';

.tooltip {
    position: absolute;
    background-color: #ffffff;
    color: #000000;
    outline: black solid 1px;
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
