import {
    computed,
    reactive,
    ref,
    toValue,
    watch,
    type MaybeRefOrGetter,
} from 'vue';

/**
 * The part of a column definition that the column layout cares about. Column
 * definitions are otherwise plain QTable columns.
 */
export interface ConfigurableColumn {
    name: string;
    label: string;
    style?: string;
    headerStyle?: string;
    classes?: string;
    headerClasses?: string;
    /**
     * `false` for utility columns (row actions, star, …): they stay pinned to
     * the start or end of the table, cannot be hidden or resized and do not
     * show up in the column settings.
     */
    configurable?: boolean;
    /** Can be moved and resized, but not hidden (e.g. the row name). */
    alwaysVisible?: boolean;
    /** Offered in the column settings, but off until the user turns it on. */
    defaultHidden?: boolean;
    /** Section of the column settings the column is listed under. */
    group?: string;
}

interface StoredLayout {
    /** Names of the configurable columns, in display order. */
    order: string[];
    /** Only columns the user toggled; everything else uses its default. */
    visibility: Record<string, boolean>;
    /** Column widths in px, only for columns the user resized. */
    widths: Record<string, number>;
}

const STORAGE_PREFIX = 'kleinkram:table-layout:';
const SAVE_DELAY_MS = 250;
export const MIN_COLUMN_WIDTH = 64;

const emptyLayout = (): StoredLayout => ({
    order: [],
    visibility: {},
    widths: {},
});

function loadLayout(tableId: string): StoredLayout {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + tableId);
        if (!raw) return emptyLayout();
        const parsed = JSON.parse(raw) as Partial<StoredLayout>;
        return {
            order: Array.isArray(parsed.order) ? parsed.order : [],
            visibility: parsed.visibility ?? {},
            widths: parsed.widths ?? {},
        };
    } catch {
        // A corrupt entry must not take the table down with it.
        return emptyLayout();
    }
}

export const isConfigurable = (column: ConfigurableColumn): boolean =>
    column.configurable !== false;

/**
 * Put the configurable columns into the stored order. Columns the stored
 * order does not know yet (new metadata types, columns added in a later
 * release) are slotted in after the column that precedes them in the
 * definition, so they do not all pile up at the end.
 */
function orderNames(definitionNames: string[], stored: string[]): string[] {
    const known = new Set(definitionNames);
    const ordered = stored.filter((name) => known.has(name));
    const placed = new Set(ordered);

    for (const [index, name] of definitionNames.entries()) {
        if (placed.has(name)) continue;
        const predecessor = definitionNames
            .slice(0, index)
            .findLast((candidate) => placed.has(candidate));
        const at =
            predecessor === undefined ? 0 : ordered.indexOf(predecessor) + 1;
        ordered.splice(at, 0, name);
        placed.add(name);
    }
    return ordered;
}

function widthStyle(width: number): string {
    return `width: ${width.toString()}px; min-width: ${width.toString()}px; max-width: ${width.toString()}px`;
}

const joinStyle = (base: string | undefined, extra: string): string =>
    base ? `${base}; ${extra}` : extra;

export interface ColumnSetting<C extends ConfigurableColumn> {
    column: C;
    visible: boolean;
    width: number | undefined;
}

/** Reactive, so it can be handed to child components as a single prop. */
export interface TableColumnLayout<C extends ConfigurableColumn> {
    /** What to hand to QTable: visible columns, in order, widths applied. */
    readonly columns: C[];
    /** Every configurable column in display order, for the settings menu. */
    readonly settings: ColumnSetting<C>[];
    /** Whether resizing and the settings menu apply (not on compact screens). */
    readonly isCustomizable: boolean;
    readonly isCustomized: boolean;
    setVisible: (name: string, visible: boolean) => void;
    /** Place column `name` right before or after column `target`. */
    move: (name: string, target: string, position: 'before' | 'after') => void;
    setWidth: (name: string, width: number | undefined) => void;
    reset: () => void;
}

/**
 * User-adjustable column layout for a QTable: which columns are shown, in
 * which order and at which width. The layout is kept per `tableId` in local
 * storage, so it survives reloads without a backend round trip.
 *
 * On compact screens the table falls back to the fixed `compactColumns`
 * selection, as there is no room for a custom layout anyway.
 */
export function useTableColumns<C extends ConfigurableColumn>(
    tableId: string,
    definitions: MaybeRefOrGetter<C[]>,
    options: {
        compact?: MaybeRefOrGetter<boolean>;
        compactColumns?: string[];
    } = {},
): TableColumnLayout<C> {
    const layout = ref<StoredLayout>(loadLayout(tableId));

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    watch(
        layout,
        (value) => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                try {
                    localStorage.setItem(
                        STORAGE_PREFIX + tableId,
                        JSON.stringify(value),
                    );
                } catch {
                    // Storage full or disabled: the layout just won't persist.
                }
            }, SAVE_DELAY_MS);
        },
        { deep: true },
    );

    const isCompact = computed(() => toValue(options.compact) ?? false);
    const isCustomizable = computed(() => !isCompact.value);

    const configurableDefinitions = computed(() =>
        toValue(definitions).filter((column) => isConfigurable(column)),
    );

    const orderedNames = computed(() =>
        orderNames(
            configurableDefinitions.value.map((column) => column.name),
            layout.value.order,
        ),
    );

    const isVisible = (column: C): boolean =>
        column.alwaysVisible === true ||
        (layout.value.visibility[column.name] ?? !column.defaultHidden);

    const settings = computed<ColumnSetting<C>[]>(() => {
        const byName = new Map(
            configurableDefinitions.value.map((column) => [
                column.name,
                column,
            ]),
        );
        return orderedNames.value.flatMap((name) => {
            const column = byName.get(name);
            if (!column) return [];
            return [
                {
                    column,
                    visible: isVisible(column),
                    width: layout.value.widths[name],
                },
            ];
        });
    });

    const columns = computed<C[]>(() => {
        const all = toValue(definitions);

        if (isCompact.value) {
            if (!options.compactColumns) return all;
            const compact = new Set(options.compactColumns);
            return all.filter((column) => compact.has(column.name));
        }

        // Utility columns stay pinned: the ones defined before the first
        // configurable column lead (star), all others trail (row actions).
        const firstConfigurable = all.findIndex((column) =>
            isConfigurable(column),
        );
        const utility = (index: number, column: C): boolean =>
            !isConfigurable(column) && index < firstConfigurable;
        const arranged = [
            ...all.filter((column, index) => utility(index, column)),
            ...settings.value.map((setting) => setting.column),
            ...all.filter(
                (column, index) =>
                    !isConfigurable(column) && !utility(index, column),
            ),
        ];

        return arranged
            .filter((column) => !isConfigurable(column) || isVisible(column))
            .map((column) => {
                const width = layout.value.widths[column.name];
                if (width === undefined) return column;
                return {
                    ...column,
                    style: joinStyle(column.style, widthStyle(width)),
                    headerStyle: joinStyle(
                        column.headerStyle,
                        widthStyle(width),
                    ),
                    classes: joinStyle(column.classes, 'kk-col-sized'),
                    headerClasses: joinStyle(
                        column.headerClasses,
                        'kk-col-sized',
                    ),
                };
            });
    });

    const isCustomized = computed(
        () =>
            layout.value.order.length > 0 ||
            Object.keys(layout.value.visibility).length > 0 ||
            Object.keys(layout.value.widths).length > 0,
    );

    function setVisible(name: string, visible: boolean): void {
        const order = orderedNames.value.filter(
            (candidate) => candidate !== name,
        );
        if (visible) {
            // Newly shown columns go to the end of the visible ones, where
            // the user is most likely to look for them.
            const visibleNames = new Set(
                settings.value
                    .filter((setting) => setting.visible)
                    .map((setting) => setting.column.name),
            );
            const lastVisible = order.findLastIndex((candidate) =>
                visibleNames.has(candidate),
            );
            order.splice(lastVisible + 1, 0, name);
        } else {
            order.splice(orderedNames.value.indexOf(name), 0, name);
        }
        layout.value.order = order;
        layout.value.visibility = {
            ...layout.value.visibility,
            [name]: visible,
        };
    }

    function move(
        name: string,
        target: string,
        position: 'before' | 'after',
    ): void {
        if (name === target) return;
        const order = orderedNames.value.filter(
            (candidate) => candidate !== name,
        );
        const at = order.indexOf(target);
        if (at === -1) return;
        order.splice(position === 'before' ? at : at + 1, 0, name);
        layout.value.order = order;
    }

    function setWidth(name: string, width: number | undefined): void {
        const widths = Object.fromEntries(
            Object.entries(layout.value.widths).filter(
                ([candidate]) => candidate !== name,
            ),
        );
        if (width !== undefined) {
            widths[name] = Math.max(MIN_COLUMN_WIDTH, Math.round(width));
        }
        layout.value.widths = widths;
    }

    function reset(): void {
        layout.value = emptyLayout();
    }

    return reactive({
        columns,
        settings,
        isCustomizable,
        isCustomized,
        setVisible,
        move,
        setWidth,
        reset,
    }) as TableColumnLayout<C>;
}
