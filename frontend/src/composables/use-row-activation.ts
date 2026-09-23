import type { Ref } from 'vue';

interface RowWithUuid {
    uuid: string;
}

/**
 * A row click means two things in these tables, and only one can win at a
 * time.
 *
 * While nothing is selected it drills down a level — project to missions,
 * mission to files — which is the table's primary job and stays untouched.
 * Once something is selected the user is doing bulk work, so the same click
 * toggles the row instead of navigating away from the selection they are
 * still building. Clearing the selection restores navigation.
 *
 * This is only safe where the selection is visible: the bulk-action bar and
 * the "select all N matching" banner are on screen the whole time the mode is
 * active, so it never changes silently. Do not use it on a table whose
 * selection has no such indicator.
 *
 * Navigation stays reachable in either mode through the name link in the row,
 * and through the row menu.
 */
export function useRowActivation<T extends RowWithUuid>(
    selected: Ref<T[]>,
    navigate: (row: T) => Promise<void>,
): {
    onRowClick: (event: Event | undefined, row: T) => Promise<void>;
} {
    function toggle(row: T): void {
        const index = selected.value.findIndex(
            (entry) => entry.uuid === row.uuid,
        );
        selected.value =
            index === -1
                ? [...selected.value, row]
                : selected.value.toSpliced(index, 1);
    }

    async function onRowClick(_: Event | undefined, row: T): Promise<void> {
        if (selected.value.length > 0) {
            toggle(row);
            return;
        }
        await navigate(row);
    }

    return { onRowClick };
}
