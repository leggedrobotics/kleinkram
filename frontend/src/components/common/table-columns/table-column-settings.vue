<template>
    <q-btn
        v-if="layout.isCustomizable"
        flat
        round
        dense
        size="sm"
        color="grey-8"
        icon="sym_o_view_column"
        aria-label="Configure columns"
        @click.stop
    >
        <q-tooltip>Configure columns</q-tooltip>

        <q-menu
            anchor="bottom right"
            self="top right"
            class="column-settings"
            @hide="clearFilter"
        >
            <div class="column-settings__header row items-center no-wrap">
                <span class="text-subtitle2 col">Columns</span>
                <q-btn
                    flat
                    dense
                    no-caps
                    color="primary"
                    label="Reset"
                    :disable="!layout.isCustomized"
                    @click="layout.reset"
                />
            </div>

            <q-list dense>
                <q-item-label header class="column-settings__section">
                    Shown
                </q-item-label>
                <q-item
                    v-for="setting in shown"
                    :key="setting.column.name"
                    draggable="true"
                    class="column-settings__item"
                    :class="{
                        'column-settings__item--dragging':
                            dragged === setting.column.name,
                        'column-settings__item--drop-before':
                            dropTarget === setting.column.name && dropBefore,
                        'column-settings__item--drop-after':
                            dropTarget === setting.column.name && !dropBefore,
                    }"
                    @dragstart="
                        (event: DragEvent) => onDragStart(event, setting)
                    "
                    @dragover.prevent="
                        (event: DragEvent) => onDragOver(event, setting)
                    "
                    @dragleave="
                        (event: DragEvent) => onDragLeave(event, setting)
                    "
                    @drop.prevent="() => onDrop(setting)"
                    @dragend="onDragEnd"
                >
                    <q-item-section side class="column-settings__grip">
                        <button
                            type="button"
                            class="column-settings__grip-button"
                            :data-column-grip="setting.column.name"
                            :aria-label="`Move ${setting.column.label}, use the up and down arrow keys`"
                            @keydown.up.prevent="
                                (event: KeyboardEvent) =>
                                    moveByKey(event, setting, -1)
                            "
                            @keydown.down.prevent="
                                (event: KeyboardEvent) =>
                                    moveByKey(event, setting, 1)
                            "
                        >
                            <q-icon name="sym_o_drag_indicator" size="18px" />
                        </button>
                    </q-item-section>
                    <q-item-section>
                        <q-item-label>{{ setting.column.label }}</q-item-label>
                        <q-item-label v-if="setting.column.group" caption>
                            {{ setting.column.group }}
                        </q-item-label>
                    </q-item-section>
                    <q-item-section v-if="setting.width !== undefined" side>
                        <q-btn
                            flat
                            round
                            dense
                            size="sm"
                            icon="sym_o_fit_width"
                            :aria-label="`Reset width of ${setting.column.label}`"
                            @click="
                                () =>
                                    layout.setWidth(
                                        setting.column.name,
                                        undefined,
                                    )
                            "
                        >
                            <q-tooltip>
                                Reset width ({{ setting.width }}px)
                            </q-tooltip>
                        </q-btn>
                    </q-item-section>
                    <q-item-section side>
                        <q-btn
                            flat
                            round
                            dense
                            size="sm"
                            :icon="
                                setting.column.alwaysVisible
                                    ? 'sym_o_lock'
                                    : 'sym_o_visibility_off'
                            "
                            :disable="setting.column.alwaysVisible"
                            :aria-label="
                                setting.column.alwaysVisible
                                    ? `${setting.column.label} cannot be hidden`
                                    : `Hide ${setting.column.label}`
                            "
                            @click="
                                () =>
                                    layout.setVisible(
                                        setting.column.name,
                                        false,
                                    )
                            "
                        >
                            <q-tooltip v-if="!setting.column.alwaysVisible">
                                Hide column
                            </q-tooltip>
                        </q-btn>
                    </q-item-section>
                </q-item>

                <template v-if="hidden.length > 0">
                    <q-separator class="q-my-xs" />
                    <div
                        v-if="hidden.length > FILTER_THRESHOLD || filter"
                        class="q-px-md q-pt-xs"
                    >
                        <q-input
                            v-model="filter"
                            dense
                            outlined
                            clearable
                            placeholder="Find column"
                            @keydown.stop
                        >
                            <template #prepend>
                                <q-icon name="sym_o_search" size="18px" />
                            </template>
                        </q-input>
                    </div>

                    <div class="column-settings__available">
                        <template
                            v-for="group in hiddenGroups"
                            :key="group.name"
                        >
                            <q-item-label
                                header
                                class="column-settings__section"
                            >
                                {{ group.name }}
                            </q-item-label>
                            <q-item
                                v-for="setting in group.settings"
                                :key="setting.column.name"
                                dense
                                clickable
                                @click="
                                    () =>
                                        layout.setVisible(
                                            setting.column.name,
                                            true,
                                        )
                                "
                            >
                                <q-item-section side>
                                    <q-icon name="sym_o_add" size="18px" />
                                </q-item-section>
                                <q-item-section>
                                    {{ setting.column.label }}
                                </q-item-section>
                            </q-item>
                        </template>
                        <q-item v-if="hiddenGroups.length === 0" dense>
                            <q-item-section class="text-grey-7">
                                No matching columns
                            </q-item-section>
                        </q-item>
                    </div>
                </template>
            </q-list>
        </q-menu>
    </q-btn>
</template>

<script setup lang="ts" generic="C extends ConfigurableColumn">
import type {
    ColumnSetting,
    ConfigurableColumn,
    TableColumnLayout,
} from 'src/composables/use-table-columns';
import { computed, nextTick, ref } from 'vue';

/**
 * Column picker for a table using `useTableColumns`: drag shown columns to
 * reorder them, hide them, or add hidden ones back.
 */
const properties = defineProps<{
    layout: TableColumnLayout<C>;
}>();

const FILTER_THRESHOLD = 8;
const DEFAULT_GROUP = 'Hidden columns';

const filter = ref('');

function clearFilter(): void {
    filter.value = '';
}

const shown = computed(() =>
    properties.layout.settings.filter((setting) => setting.visible),
);
const hidden = computed(() =>
    properties.layout.settings.filter((setting) => !setting.visible),
);

const hiddenGroups = computed(() => {
    const needle = (filter.value || '').trim().toLowerCase();
    const groups = new Map<string, ColumnSetting<C>[]>();
    for (const setting of hidden.value) {
        if (needle && !setting.column.label.toLowerCase().includes(needle)) {
            continue;
        }
        const name = setting.column.group ?? DEFAULT_GROUP;
        groups.set(name, [...(groups.get(name) ?? []), setting]);
    }
    return [...groups.entries()]
        .map(([name, settings]) => ({
            name,
            settings: settings.toSorted((a, b) =>
                a.column.label.localeCompare(b.column.label),
            ),
        }))
        .toSorted(
            (a, b) =>
                Number(b.name === DEFAULT_GROUP) -
                Number(a.name === DEFAULT_GROUP),
        );
});

const dragged = ref<string>();
const dropTarget = ref<string>();
const dropBefore = ref(true);

function onDragStart(event: DragEvent, setting: ColumnSetting<C>): void {
    dragged.value = setting.column.name;
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        // Firefox refuses to start a drag without data.
        event.dataTransfer.setData('text/plain', setting.column.name);
    }
}

function onDragOver(event: DragEvent, setting: ColumnSetting<C>): void {
    if (dragged.value === undefined) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dropTarget.value = setting.column.name;
    dropBefore.value = event.clientY < rect.top + rect.height / 2;
}

function onDragLeave(event: DragEvent, setting: ColumnSetting<C>): void {
    // Moving onto a child of the item also fires dragleave on the item
    const item = event.currentTarget as HTMLElement;
    if (item.contains(event.relatedTarget as Node | null)) return;
    if (dropTarget.value === setting.column.name) dropTarget.value = undefined;
}

function onDrop(target: ColumnSetting<C>): void {
    if (dragged.value !== undefined) {
        properties.layout.move(
            dragged.value,
            target.column.name,
            dropBefore.value ? 'before' : 'after',
        );
    }
    onDragEnd();
}

/**
 * Keyboard alternative to dragging: move the column one place up or down
 * and keep the focus on its handle, so it can be moved again right away.
 */
async function moveByKey(
    event: KeyboardEvent,
    setting: ColumnSetting<C>,
    direction: -1 | 1,
): Promise<void> {
    const index = shown.value.indexOf(setting);
    const neighbour = shown.value[index + direction];
    if (!neighbour) return;

    properties.layout.move(
        setting.column.name,
        neighbour.column.name,
        direction === -1 ? 'before' : 'after',
    );

    const list = (event.currentTarget as HTMLElement).closest('.q-list');
    await nextTick();
    list?.querySelector<HTMLElement>(
        `[data-column-grip="${CSS.escape(setting.column.name)}"]`,
    )?.focus();
}

function onDragEnd(): void {
    dragged.value = undefined;
    dropTarget.value = undefined;
}
</script>

<style scoped>
.column-settings__header {
    padding: 8px 8px 0 16px;
}

.column-settings__section {
    padding-top: 8px;
    padding-bottom: 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.column-settings__item {
    cursor: grab;
    border-top: 2px solid transparent;
    border-bottom: 2px solid transparent;
}

.column-settings__item--dragging {
    opacity: 0.4;
}

.column-settings__item--drop-before {
    border-top-color: var(--q-primary);
}

.column-settings__item--drop-after {
    border-bottom-color: var(--q-primary);
}

/* Long metadata lists scroll on their own, the shown columns stay in view */
.column-settings__available {
    max-height: 280px;
    overflow-y: auto;
}

.column-settings__grip-button {
    display: flex;
    padding: 2px;
    border: 0;
    border-radius: 4px;
    background: none;
    color: inherit;
    cursor: grab;
}

.column-settings__grip-button:focus-visible {
    outline: 2px solid var(--q-primary);
}

.column-settings__grip {
    padding-right: 8px;
    color: #9e9e9e;
}
</style>

<style>
.column-settings {
    width: 300px;
    max-height: 70vh;
}
</style>
