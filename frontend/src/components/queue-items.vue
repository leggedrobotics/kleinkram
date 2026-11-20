<template>
    <div class="row items-end queue-filters">
        <div
            class="col-12 col-md-5 q-py-md"
            :class="$q.screen.gt.sm ? 'q-pr-md' : ''"
        >
            <label :for="sinceId">Processing since</label>
            <q-input
                v-model="sinceText"
                :for="sinceId"
                outlined
                dense
                mask="##.##.#### ##:##"
                placeholder="DD.MM.YYYY HH:mm"
                hide-bottom-space
                no-error-icon
                :error="!isValidSince(sinceText)"
                bg-color="white"
                class="since-field"
            >
                <template #prepend>
                    <q-icon name="sym_o_calendar_today" />
                </template>
                <q-menu
                    anchor="bottom left"
                    self="top left"
                    :offset="[0, 4]"
                    no-focus
                    no-refocus
                    class="since-picker"
                >
                    <q-date
                        v-model="sinceDay"
                        mask="DD.MM.YYYY"
                        minimal
                        flat
                        color="button-primary"
                    />
                    <div class="since-picker__time">
                        <label :for="sinceTimeId">Time</label>
                        <q-input
                            v-model="sinceTime"
                            :for="sinceTimeId"
                            outlined
                            dense
                            mask="##:##"
                            placeholder="HH:mm"
                            hide-bottom-space
                            no-error-icon
                            :error="!isValidTime(sinceTime)"
                            class="since-picker__time-input"
                        />
                    </div>
                </q-menu>
            </q-input>
        </div>
        <div
            class="col-12 col-md-5 q-py-md"
            :class="$q.screen.gt.sm ? 'q-pr-md' : ''"
        >
            <label :for="statusId">Status</label>
            <q-field
                :model-value="fileStateFilter"
                :for="statusId"
                outlined
                dense
                hide-bottom-space
                bg-color="white"
                :clearable="fileStateFilter.length > 0"
                class="status-field cursor-pointer"
                @clear="clearSelection"
            >
                <template #control>
                    <div
                        :id="statusId"
                        class="status-field__value"
                        tabindex="0"
                        role="combobox"
                        aria-haspopup="listbox"
                    >
                        <span
                            v-if="fileStateFilter.length === 0"
                            class="status-field__placeholder"
                        >
                            All states
                        </span>
                        <template v-else>
                            {{ statusSummary.text }}
                            <span
                                v-if="statusSummary.more > 0"
                                class="status-field__more"
                            >
                                +{{ statusSummary.more }}
                            </span>
                        </template>
                    </div>
                </template>
                <template #append>
                    <q-icon name="sym_o_arrow_drop_down" />
                </template>
                <q-menu
                    style="min-width: 280px"
                    anchor="bottom left"
                    self="top left"
                    :offset="[0, 4]"
                >
                    <q-list
                        dense
                        class="status-menu"
                        role="listbox"
                        aria-multiselectable="true"
                    >
                        <template
                            v-for="group in STATE_GROUPS"
                            :key="group.label"
                        >
                            <q-item
                                clickable
                                class="status-menu__group"
                                @click="() => toggleGroup(group.states)"
                            >
                                <q-item-section side>
                                    <q-checkbox
                                        :model-value="groupValue(group.states)"
                                        dense
                                        size="sm"
                                        color="button-primary"
                                        tabindex="-1"
                                        class="no-pointer-events"
                                    />
                                </q-item-section>
                                <q-item-section>{{
                                    group.label
                                }}</q-item-section>
                            </q-item>
                            <q-item
                                v-for="state in group.states"
                                :key="state"
                                clickable
                                role="option"
                                :aria-selected="fileStateFilter.includes(state)"
                                class="status-menu__item"
                                @click="() => toggleState(state)"
                            >
                                <q-item-section side>
                                    <q-checkbox
                                        :model-value="
                                            fileStateFilter.includes(state)
                                        "
                                        dense
                                        size="sm"
                                        color="button-primary"
                                        tabindex="-1"
                                        class="no-pointer-events"
                                    />
                                </q-item-section>
                                <q-item-section>{{
                                    STATE_LABELS[state]
                                }}</q-item-section>
                            </q-item>
                        </template>
                    </q-list>
                </q-menu>
            </q-field>
        </div>
        <div
            class="col-12 col-md-2 q-py-md"
            :class="$q.screen.gt.sm ? '' : 'q-pt-none'"
        >
            <app-refresh-button @click="refresh" />
        </div>
    </div>

    <!-- TODO: bulk actions go in the default slot as they arrive -->
    <table-selection-bar
        noun="entry"
        :count="selected.length"
        @clear="clearRowSelection"
    />

    <q-table
        ref="tableReference"
        v-model:pagination="pagination"
        v-model:selected="selected"
        :rows="queueEntries?.data || []"
        :columns="columns as any"
        :visible-columns="visibleColumns"
        row-key="uuid"
        flat
        :bordered="!$q.screen.xs"
        :grid="$q.screen.xs"
        :loading="isLoading"
        binary-state-sort
        :selection="$q.screen.lt.md ? 'none' : 'multiple'"
        class="queue-table"
        @row-click="rowClick"
    >
        <template #item="props">
            <div class="col-12 q-pb-sm">
                <q-card
                    flat
                    bordered
                    class="queue-card"
                    @click="() => openRow(props.row)"
                >
                    <q-card-section>
                        <div class="row no-wrap items-start">
                            <div class="col" style="min-width: 0">
                                <div
                                    class="queue-card__name text-weight-medium"
                                >
                                    {{ displayNameOf(props.row) }}
                                </div>
                                <div
                                    class="queue-card__meta text-caption q-mt-xs"
                                >
                                    {{ props.row.mission.project.name }} /
                                    {{ props.row.mission.name }}
                                </div>
                            </div>
                            <q-btn
                                flat
                                round
                                icon="sym_o_more_vert"
                                unelevated
                                color="primary"
                                aria-label="File actions"
                                class="queue-card__action cursor-pointer"
                                @click.stop
                            >
                                <q-menu
                                    auto-close
                                    style="
                                        max-width: 200px;
                                        min-width: 160px;
                                        width: 180px;
                                    "
                                >
                                    <q-list>
                                        <q-item
                                            v-for="action in rowActions(
                                                props.row,
                                            )"
                                            :key="action.label"
                                            v-ripple
                                            clickable
                                            :disable="action.disabled"
                                            @click="action.handler"
                                        >
                                            <q-item-section>
                                                {{ action.label }}
                                            </q-item-section>
                                        </q-item>
                                    </q-list>
                                </q-menu>
                            </q-btn>
                        </div>

                        <div
                            class="row items-center justify-between q-mt-sm"
                            style="gap: 8px"
                        >
                            <q-badge :color="getColor(props.row.state)">
                                {{ getSimpleFileStateName(props.row.state) }}
                            </q-badge>
                            <span class="queue-card__meta text-caption">
                                {{ lastUpdateOf(props.row) }}
                            </span>
                        </div>

                        <div class="queue-card__meta text-caption q-mt-xs">
                            {{ props.row.location }} ·
                            {{ props.row.creator.name }}
                        </div>
                    </q-card-section>
                </q-card>
            </div>
        </template>

        <template #body-selection="props">
            <q-checkbox
                v-model="props.selected"
                color="grey-8"
                class="checkbox-with-hitbox"
            />
        </template>
        <template #body-cell-Status="props">
            <q-td :props="props">
                <q-badge :color="getColor(props.row.state)">
                    <q-tooltip>
                        {{ getDetailedFileState(props.row.state) }}
                    </q-tooltip>
                    {{ getSimpleFileStateName(props.row.state) }}
                </q-badge>
            </q-td>
        </template>
        <template #body-cell-action="props">
            <q-td :props="props">
                <q-btn
                    flat
                    round
                    dense
                    icon="sym_o_more_vert"
                    unelevated
                    color="primary"
                    class="cursor-pointer"
                    @click.stop
                >
                    <q-menu
                        auto-close
                        style="max-width: 150px; min-width: 140px; width: 145px"
                    >
                        <q-list>
                            <q-item
                                v-for="action in rowActions(props.row)"
                                :key="action.label"
                                v-ripple
                                clickable
                                :disable="action.disabled"
                                @click="action.handler"
                            >
                                <q-item-section>
                                    {{ action.label }}
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
            </q-td>
        </template>
    </q-table>
</template>

<script setup lang="ts">
import type { FileQueueEntryDto } from '@kleinkram/api-dto/types/file/file-queue-entry.dto';
import { FileLocation, QueueState } from '@kleinkram/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { QTable, useQuasar } from 'quasar';
import { useRowActivation } from 'src/composables/use-row-activation';
import ConfirmDeleteFile from 'src/dialogs/confirm-delete-file-dialog.vue';
import ROUTES from 'src/router/routes';
import { formatDate, parseDate } from 'src/services/date-formating';
import {
    _downloadFile,
    getColor,
    getDetailedFileState,
    getSimpleFileStateName,
} from 'src/services/generic';
import { findOneByNameAndMission } from 'src/services/queries/file';
import { computed, ref, Ref, useId, watch } from 'vue';
import { useRouter } from 'vue-router';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import TableSelectionBar from 'components/common/table-selection-bar.vue';

import {
    useCancelProcessing,
    useDeleteQueueItem,
    useQueue,
} from 'src/composables/use-file-queue';
import { canDeleteMission, usePermissionsQuery } from 'src/hooks/query-hooks';

const $router = useRouter();
const queryClient = useQueryClient();
const $q = useQuasar();

const tableReference: Ref<QTable | undefined> = ref(undefined);
const now = new Date();
const startDate = ref(formatDate(new Date(now.getTime() - 1000 * 60 * 30)));
const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 10,
    rowsNumber: 0,
});

const queryPagination = computed(() => ({
    skip: (pagination.value.page - 1) * pagination.value.rowsPerPage,
    take: pagination.value.rowsPerPage,
}));

const selected = ref<FileQueueEntryDto[]>([]);

const fileStateFilter = ref<string[]>([]);

/** readable names of the queue states, in the order of their lifecycle */
const STATE_LABELS: Record<string, string> = {
    AWAITING_UPLOAD: 'Awaiting upload',
    AWAITING_PROCESSING: 'Awaiting processing',
    PROCESSING: 'Processing',
    DOWNLOADING: 'Downloading',
    CONVERTING_AND_EXTRACTING_TOPICS: 'Converting & extracting topics',
    UPLOADING: 'Uploading',
    COMPLETED: 'Completed',
    ERROR: 'Error',
    CORRUPTED: 'Corrupted',
    CANCELED: 'Canceled',
    UNSUPPORTED_FILE_TYPE: 'Unsupported file type',
    FILE_ALREADY_EXISTS: 'File already exists',
};

/** the states grouped by phase, so a whole phase is one click */
const STATE_GROUPS: { label: string; states: string[] }[] = [
    { label: 'Waiting', states: ['AWAITING_UPLOAD', 'AWAITING_PROCESSING'] },
    {
        label: 'In progress',
        states: [
            'PROCESSING',
            'DOWNLOADING',
            'CONVERTING_AND_EXTRACTING_TOPICS',
            'UPLOADING',
        ],
    },
    { label: 'Done', states: ['COMPLETED'] },
    {
        label: 'Failed',
        states: [
            'ERROR',
            'CORRUPTED',
            'CANCELED',
            'UNSUPPORTED_FILE_TYPE',
            'FILE_ALREADY_EXISTS',
        ],
    },
];

/** one line, whatever is selected: the first two names and "+N" */
const statusSummary = computed(() => {
    const names = fileStateFilter.value.map((state) => STATE_LABELS[state]);
    return {
        text: names.slice(0, 2).join(', '),
        more: Math.max(0, names.length - 2),
    };
});

const toggleState = (state: string): void => {
    fileStateFilter.value = fileStateFilter.value.includes(state)
        ? fileStateFilter.value.filter((item) => item !== state)
        : [...fileStateFilter.value, state];
};

/** true when all of a group is selected, null (indeterminate) when some */
const groupValue = (states: string[]): boolean | null => {
    const count = states.filter((state) =>
        fileStateFilter.value.includes(state),
    ).length;
    if (count === 0) return false;
    return count === states.length ? true : null;
};

const toggleGroup = (states: string[]): void => {
    fileStateFilter.value =
        groupValue(states) === true
            ? fileStateFilter.value.filter((state) => !states.includes(state))
            : [...new Set([...fileStateFilter.value, ...states])];
};

const clearSelection = (): void => {
    fileStateFilter.value = fileStateFilter.value.slice(0, 0);
};

watch(fileStateFilter, () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (fileStateFilter.value) {
        fileStateFilter.value = fileStateFilter.value.toSorted((a, b) =>
            // @ts-ignore
            QueueState[a] > QueueState[b] ? 1 : -1,
        );
    }
});

const fileStateFilterEnums = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!fileStateFilter.value) return [];
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return fileStateFilter.value.map((state) => QueueState[state]);
});

// Use Composable
const sinceId = `queue-since-${useId()}`;
const sinceTimeId = `queue-since-time-${useId()}`;
const statusId = `queue-status-${useId()}`;

const isValidTime = (time: string): boolean =>
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

const isValidSince = (text: string): boolean =>
    /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(text) &&
    isValidTime(text.slice(11)) &&
    !Number.isNaN(parseDate(text).getTime());

/** the whole value as typed; applied to `startDate` once it is complete */
const typedSince = ref<string | undefined>(undefined);
const sinceText = computed({
    get: () => typedSince.value ?? startDate.value,
    set: (text: string | number | null) => {
        const value = String(text ?? '');
        typedSince.value = value;
        if (!isValidSince(value)) return;
        startDate.value = value;
        typedSince.value = undefined;
    },
});

/** the day part of `startDate` (DD.MM.YYYY), picked in the calendar */
const sinceDay = computed({
    get: () => startDate.value.split(' ')[0] ?? '',
    set: (day: string | null) => {
        if (!day) return;
        startDate.value = `${day} ${startDate.value.split(' ')[1] ?? '00:00'}`;
    },
});

/** the time part of `startDate` (HH:mm), typed; applied once it is valid */
const typedTime = ref<string | undefined>(undefined);
const sinceTime = computed({
    get: () => typedTime.value ?? startDate.value.split(' ')[1] ?? '',
    set: (time: string | number | null) => {
        const value = String(time ?? '');
        typedTime.value = value;
        if (!isValidTime(value)) return;
        startDate.value = `${sinceDay.value} ${value}`;
        typedTime.value = undefined;
    },
});

const startDateIso = computed(() => {
    try {
        return parseDate(startDate.value).toISOString();
    } catch {
        return '';
    }
});

const { data: queueEntries, isLoading } = useQueue(
    startDateIso,
    // @ts-ignore
    fileStateFilterEnums,
    queryPagination,
);

watch(queueEntries, (newValue) => {
    if (newValue) {
        pagination.value.rowsNumber = newValue.count;
    }
});

const { mutateAsync: removeFile } = useDeleteQueueItem();
const { mutate: _cancelProcessing } = useCancelProcessing();
const { data: permissions } = usePermissionsQuery();

const openDeleteFileDialog = (queueEntry: FileQueueEntryDto): void => {
    $q.dialog({
        component: ConfirmDeleteFile,
        componentProps: {
            filename: queueEntry.displayName,
            // the dialog runs the delete and shows a failure itself
            action: () =>
                removeFile({
                    missionUUID: queueEntry.mission.uuid,
                    queueUUID: queueEntry.uuid,
                }),
        },
    });
};

// Refresh function to invalidate the query
async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'queue',
    });
}

/**
 * Navigates while nothing is selected, toggles the row once something is.
 * See use-row-activation for why that is safe here.
 */
const { onRowClick: rowClick } = useRowActivation(selected, openRow);

function clearRowSelection(): void {
    selected.value = [];
}

async function openRow(row: FileQueueEntryDto): Promise<void> {
    const isFile =
        row.displayName.endsWith('.bag') || row.displayName.endsWith('.mcap');
    const isCompleted = row.state === QueueState.COMPLETED;
    if (isFile && isCompleted) {
        await findOneByNameAndMission(row.displayName, row.mission.uuid).then(
            async (file: FileWithTopicDto) => {
                await $router.push({
                    name: ROUTES.FILE.routeName,

                    params: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        file_uuid: file.uuid,
                        missionUuid: row.mission.uuid,
                        projectUuid: row.mission.project.uuid,
                    },
                });
            },
        );
        return;
    }

    await $router.push({
        name: ROUTES.FILES.routeName,
        params: {
            missionUuid: row.mission.uuid,
            projectUuid: row.mission.project.uuid,
        },
    });
}

function canDelete(row: FileQueueEntryDto): boolean {
    return (
        row.state !== QueueState.AWAITING_PROCESSING &&
        row.state !== QueueState.CANCELED &&
        row.state !== QueueState.ERROR &&
        row.state !== QueueState.CORRUPTED &&
        row.state !== QueueState.AWAITING_UPLOAD &&
        row.state !== QueueState.UNSUPPORTED_FILE_TYPE &&
        row.state !== QueueState.FILE_ALREADY_EXISTS
    );
}

async function downloadFile(row: FileQueueEntryDto): Promise<void> {
    await findOneByNameAndMission(row.displayName, row.mission.uuid).then(
        async (file: FileWithTopicDto) => {
            await _downloadFile(file.uuid, file.filename);
        },
    );
}

/**
 * On phones the table is rendered as a card list (see the `#item` slot), on
 * small screens we only keep the columns that carry the essential
 * information so that the table does not need horizontal scrolling.
 */
const visibleColumns = computed<string[] | undefined>(() =>
    $q.screen.lt.md
        ? ['Filename', 'Mission', 'Status', 'change', 'action']
        : undefined,
);

function displayNameOf(row: FileQueueEntryDto): string {
    if (
        row.displayName === row.identifier &&
        row.location === FileLocation.DRIVE
    )
        return 'Not available';
    return row.displayName;
}

function lastUpdateOf(row: FileQueueEntryDto): string {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return row.updatedAt ? formatDate(row.updatedAt, true) : 'error';
}

interface QueueRowAction {
    label: string;
    disabled: boolean;
    handler: () => void;
}

function rowActions(row: FileQueueEntryDto): QueueRowAction[] {
    const actions: QueueRowAction[] = [
        {
            label: 'Download File',
            disabled: row.state !== QueueState.COMPLETED,
            handler: (): void => {
                void downloadFile(row);
            },
        },
    ];

    // Deleting and cancelling need DELETE on the mission
    // (CanDeleteQueueItem in the backend), so hide them otherwise.
    if (
        !canDeleteMission(
            row.mission.uuid,
            row.mission.project.uuid,
            permissions.value,
        )
    ) {
        return actions;
    }

    actions.push(
        {
            label: 'Delete File',
            disabled: !canDelete(row),
            handler: (): void => {
                openDeleteFileDialog(row);
            },
        },
        {
            label: 'Cancel Processing',
            disabled: row.state !== QueueState.AWAITING_PROCESSING,
            handler: (): void => {
                _cancelProcessing({
                    missionUUID: row.mission.uuid,
                    queueUUID: row.uuid,
                });
            },
        },
    );
    return actions;
}

const columns = [
    {
        name: 'Project',
        label: 'Project',
        align: 'left',
        field: (row: FileQueueEntryDto): string => row.mission.project.name,
    },
    {
        name: 'Mission',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: FileQueueEntryDto): string => row.mission.name,
    },
    { name: 'Status', label: 'Status', align: 'left', field: 'state' },
    {
        name: 'Location',
        label: 'File Origin',
        align: 'left',
        field: 'location',
    },
    {
        name: 'Filename',
        required: true,
        label: 'Filename',
        align: 'left',
        field: (row: FileQueueEntryDto): string => displayNameOf(row),
    },
    {
        name: 'change',
        required: true,
        label: 'Last status update',
        align: 'left',
        field: (row: FileQueueEntryDto): string => lastUpdateOf(row),
    },
    {
        name: 'Creator',
        label: 'Creator',
        align: 'left',
        field: (row: FileQueueEntryDto): string => row.creator.name,
    },
    {
        name: 'action',
        required: true,
        label: '',
        align: 'center',
        field: 'Edit',
        style: 'width: 100px',
    },
    // {name: 'id', required: true, label: 'Google Drive File ID', align: 'left', field: 'identifier'},
];
</script>

<style scoped>
/* soft state tag, same shape as the category tags */
.multi-option__check {
    padding-right: 8px;
}

/* the selection shows in the checkbox, the label keeps its colour */
.multi-option__label {
    color: #161616;
}
/* Stacked filter controls need to span the full width on small screens */
@media (max-width: 1023px) {
    .queue-filters :deep(.q-field) {
        width: 100%;
    }

    /* Enlarge the icon-only refresh button to a comfortable touch target */
    .queue-filters :deep(.q-btn) {
        height: 40px !important;
        width: 40px !important;
    }
}

.queue-card {
    cursor: pointer;
}

/* The dense row-action button is below the comfortable touch target size */
@media (max-width: 1023px) {
    .queue-table :deep(.q-td .q-btn) {
        min-height: 40px;
        min-width: 40px;
    }
}

.queue-card__name {
    overflow-wrap: anywhere;
    word-break: break-word;
}

.queue-card__meta {
    color: #58585c;
    overflow-wrap: anywhere;
}

.queue-card__action {
    min-height: 40px;
    min-width: 40px;
}

@media (max-width: 599px) {
    /* The pagination controls must wrap instead of overflowing the page */
    .queue-table :deep(.q-table__bottom) {
        flex-wrap: wrap;
        row-gap: 4px;
    }

    .queue-table :deep(.q-table__grid-content) {
        margin: 0;
    }
}

.status-field__value {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    outline: none;
}

.status-field__placeholder {
    color: #6f6f6f; /* $text-placeholder */
}

.status-field__more {
    color: #525252; /* $text-secondary */
    font-weight: 500;
}

.status-menu__group {
    color: #525252; /* $text-secondary */
    font-size: 12px;
    font-weight: 600;
}

.status-menu__item {
    padding-left: 32px;
}

.since-picker__time {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px 16px;
    border-top: 1px solid #e0e0e0; /* $border-subtle */
}

.since-picker__time-input {
    width: 96px;
}
</style>
