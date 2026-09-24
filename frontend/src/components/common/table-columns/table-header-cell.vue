<template>
    <q-th :props="cellProps" class="kk-th">
        <slot>{{ cellProps.col.label }}</slot>
        <span
            v-if="isResizable"
            class="kk-th__resizer"
            role="separator"
            aria-orientation="vertical"
            tabindex="0"
            :aria-label="`Resize column ${cellProps.col.label}`"
            @pointerdown.stop.prevent="startResize"
            @click.stop
            @dblclick.stop="resetWidth"
            @keydown.left.stop.prevent="narrow"
            @keydown.right.stop.prevent="widen"
        >
            <q-tooltip :delay="600">
                Drag to resize, double-click to reset
            </q-tooltip>
        </span>
    </q-th>
</template>

<script setup lang="ts" generic="C extends ConfigurableColumn">
import {
    isConfigurable,
    type ConfigurableColumn,
    type TableColumnLayout,
} from 'src/composables/use-table-columns';
import { computed } from 'vue';

/**
 * Drop-in for QTable's `header-cell` slot that adds a resize handle to the
 * right edge of every configurable column.
 */
const properties = defineProps<{
    cellProps: { col: C };
    layout: TableColumnLayout<C>;
}>();

const KEY_STEP = 16;

const isResizable = computed(
    () =>
        properties.layout.isCustomizable &&
        isConfigurable(properties.cellProps.col),
);

function headerWidth(handle: HTMLElement): number {
    return handle.closest('th')?.getBoundingClientRect().width ?? 0;
}

function resetWidth(): void {
    properties.layout.setWidth(properties.cellProps.col.name, undefined);
}

function nudge(event: KeyboardEvent, delta: number): void {
    const width = headerWidth(event.currentTarget as HTMLElement);
    properties.layout.setWidth(properties.cellProps.col.name, width + delta);
}

const narrow = (event: KeyboardEvent): void => {
    nudge(event, -KEY_STEP);
};
const widen = (event: KeyboardEvent): void => {
    nudge(event, KEY_STEP);
};

function startResize(event: PointerEvent): void {
    const handle = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startWidth = headerWidth(handle);
    const name = properties.cellProps.col.name;

    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('kk-col-resizing');

    const onMove = (moveEvent: PointerEvent): void => {
        properties.layout.setWidth(
            name,
            startWidth + moveEvent.clientX - startX,
        );
    };
    const onEnd = (): void => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
        document.body.classList.remove('kk-col-resizing');
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
}
</script>

<style scoped>
.kk-th {
    position: relative;
}

.kk-th__resizer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 9px;
    cursor: col-resize;
    touch-action: none;
    z-index: 1;
}

.kk-th__resizer::after {
    content: '';
    position: absolute;
    top: 25%;
    bottom: 25%;
    right: 4px;
    width: 1px;
    background: #d6d6d6;
    transition: background-color 0.15s;
}

.kk-th:hover .kk-th__resizer::after {
    background: #9e9e9e;
}

.kk-th__resizer:hover::after,
.kk-th__resizer:focus-visible::after {
    top: 0;
    bottom: 0;
    width: 2px;
    right: 3px;
    background: var(--q-primary);
}

.kk-th__resizer:focus-visible {
    outline: none;
}
</style>
