<template>
    <div
        v-if="count > 0"
        class="table-selection-bar"
        :class="isPhone ? 'table-selection-bar--phone' : 'q-py-lg'"
    >
        <!--
            Phones put the count and the way out on their own row and lay the
            actions out as a grid of full-width buttons: wrapping a toolbar
            row leaves targets too small and too close together to hit.
        -->
        <template v-if="isPhone">
            <div class="row items-center justify-between no-wrap">
                <div class="text-white text-subtitle1 text-weight-medium">
                    {{ label }}
                </div>
                <q-btn
                    flat
                    round
                    icon="sym_o_close"
                    color="white"
                    aria-label="Clear selection"
                    @click="onClear"
                >
                    <q-tooltip>Clear selection</q-tooltip>
                </q-btn>
            </div>
            <div v-if="hasActions" class="table-selection-bar__actions">
                <slot />
            </div>
        </template>

        <button-group-overlay v-else>
            <template #start>
                <div class="table-selection-bar__count">{{ label }}</div>
            </template>
            <template #end>
                <slot />
                <q-btn
                    flat
                    dense
                    padding="6px"
                    icon="sym_o_close"
                    color="white"
                    aria-label="Clear selection"
                    @click="onClear"
                >
                    <q-tooltip>Clear selection</q-tooltip>
                </q-btn>
            </template>
        </button-group-overlay>
    </div>
</template>

<script setup lang="ts">
import ButtonGroupOverlay from 'components/buttons/button-group-overlay.vue';
import { useQuasar } from 'quasar';
import { computed, useSlots } from 'vue';

/**
 * The bar that stands in for the toolbar while rows are selected.
 *
 * It exists even where there is nothing to do in bulk yet. A selection the
 * page never acknowledges is a mode with no indicator: the checkboxes fill in,
 * the row click changes meaning, and nothing on screen says why. Count and a
 * way out is the floor — actions go in the default slot as they arrive.
 */
const props = defineProps({
    /** Rows currently selected. The bar hides itself at zero. */
    count: { type: Number, required: true },
    /** Singular noun for the rows, e.g. `file`. */
    noun: { type: String, default: 'item' },
});

const emit = defineEmits(['clear']);

const $q = useQuasar();
const slots = useSlots();

const isPhone = computed(() => $q.screen.xs);
const hasActions = computed(() => slots.default !== undefined);

const label = computed(
    () =>
        `${props.count.toLocaleString()} ${
            props.count === 1 ? props.noun : `${props.noun}s`
        } selected`,
);

function onClear(): void {
    emit('clear');
}
</script>

<style scoped>
.table-selection-bar {
    background: #0f62fe;
}

.table-selection-bar--phone {
    padding: 8px 8px 8px 16px;
}

.table-selection-bar__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 8px;
    margin: 4px 8px 0 0;
}

.table-selection-bar__actions :deep(.q-btn) {
    width: 100%;
    min-height: 44px;
    justify-content: flex-start;
    text-transform: none;
}

.table-selection-bar__actions :deep(.q-btn .q-btn__content) {
    justify-content: flex-start;
    flex-wrap: nowrap;
}

.table-selection-bar__count {
    margin: 0;
    font-size: 14pt;
    color: white;
}
</style>
