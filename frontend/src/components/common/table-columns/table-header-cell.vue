<template>
    <q-th
        :props="cellProps"
        class="kk-th"
        :data-column="isResizable ? cellProps.col.name : undefined"
    >
        <slot>{{ cellProps.col.label }}</slot>
        <span
            v-if="isResizable"
            class="kk-th__resizer"
            role="separator"
            aria-orientation="vertical"
            tabindex="0"
            :aria-label="`Resize column ${cellProps.col.label}`"
            title="Drag to resize, double-click to reset"
            @pointerdown.stop.prevent="startResize"
            @click.stop
            @dblclick.stop="resetWidth"
            @keydown.left.stop.prevent="narrow"
            @keydown.right.stop.prevent="widen"
        />
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
const DRAG_THRESHOLD = 3;

const isResizable = computed(
    () =>
        properties.layout.isCustomizable &&
        isConfigurable(properties.cellProps.col),
);

function headerWidth(handle: HTMLElement): number {
    return handle.closest('th')?.getBoundingClientRect().width ?? 0;
}

/**
 * Pin every resizable column at its current width. Without this the browser
 * redistributes the space of the dragged column over its neighbours, and the
 * edge under the cursor does not follow it.
 */
function freezeHeaderRow(handle: HTMLElement): void {
    const headers = handle
        .closest('tr')
        ?.querySelectorAll<HTMLElement>('th[data-column]');
    const widths: Record<string, number> = {};
    for (const header of headers ?? []) {
        const name = header.dataset.column;
        if (name) widths[name] = header.getBoundingClientRect().width;
    }
    properties.layout.freezeWidths(widths);
}

function resetWidth(): void {
    properties.layout.setWidth(properties.cellProps.col.name, undefined);
}

function nudge(event: KeyboardEvent, delta: number): void {
    freezeHeaderRow(event.currentTarget as HTMLElement);
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

    // A click or double-click on the handle must not pin the columns; only
    // an actual drag does.
    let isDragging = false;
    const onMove = (moveEvent: PointerEvent): void => {
        if (!isDragging) {
            if (Math.abs(moveEvent.clientX - startX) < DRAG_THRESHOLD) return;
            isDragging = true;
            freezeHeaderRow(handle);
        }
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
    /* A wrapped label pushes the (hidden) sort arrow onto its own line */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Sortable headers are focusable; mouse clicks should not leave a ring */
.kk-th:focus {
    outline: none;
}

.kk-th:focus-visible {
    box-shadow: inset 0 -2px 0 var(--q-primary);
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
