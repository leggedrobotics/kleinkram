<template>
    <title-section title="Datatable" />

    <FilesFilter :use-filter="filterHook" />

    <!--
        The card list has no column headers, so phones get an explicit sort
        control and a hint about how many rows are currently selected.
    -->
    <div v-if="isPhone" class="row items-center justify-between q-mb-sm">
        <q-btn-dropdown
            flat
            dense
            no-caps
            class="text-grey-8"
            icon="sym_o_swap_vert"
            :label="`Sort: ${activeSortLabel}`"
            aria-label="Change sorting"
        >
            <q-list>
                <q-item
                    v-for="option in sortOptions"
                    :key="option.value"
                    v-close-popup
                    clickable
                    @click="() => toggleSort(option.value)"
                >
                    <q-item-section>{{ option.label }}</q-item-section>
                    <q-item-section side>
                        <q-icon
                            v-if="pagination.sortBy === option.value"
                            :name="
                                pagination.descending
                                    ? 'sym_o_arrow_downward'
                                    : 'sym_o_arrow_upward'
                            "
                            size="18px"
                        />
                    </q-item-section>
                </q-item>
            </q-list>
        </q-btn-dropdown>

        <span v-if="selected.length > 0" class="text-caption text-grey-7">
            {{ selected.length }} selected
        </span>
    </div>

    <q-table
        ref="tableReference"
        v-model:pagination="pagination"
        v-model:selected="selected"
        flat
        bordered
        separator="none"
        :rows-per-page-options="[5, 10, 20, 50, 100]"
        :rows="data"
        :columns="visibleColumns as QTableColumn<FileWithTopicDto>[]"
        row-key="uuid"
        :loading="loading"
        selection="multiple"
        binary-state-sort
        :grid="isPhone"
        :wrap-cells="isCompact"
        :rows-per-page-label="isPhone ? 'Rows' : undefined"
        :class="{ 'files-table--grid': isPhone }"
        @row-click="onRowClick"
        @request="setPagination"
    >
        <template #body-selection="props">
            <q-checkbox
                v-model="props.selected"
                color="grey-8"
                class="checkbox-with-hitbox"
            />
        </template>
        <template #body-cell-state="props">
            <q-td :props="props">
                <q-icon
                    :name="getIcon(props.row.state)"
                    :color="getColorFileState(props.row.state)"
                    size="20px"
                >
                    <q-tooltip>{{ getTooltip(props.row.state) }}</q-tooltip>
                </q-icon>
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
                    <q-menu auto-close>
                        <q-list>
                            <edit-file-dialog-opener :file="props.row">
                                <q-item v-ripple clickable>
                                    <q-item-section>Edit File</q-item-section>
                                </q-item>
                            </edit-file-dialog-opener>
                            <q-item
                                v-ripple
                                clickable
                                @click="() => onRowClick(undefined, props.row)"
                            >
                                <q-item-section>View File</q-item-section>
                            </q-item>
                            <q-item v-ripple clickable>
                                <q-item-section>
                                    <DeleteFileDialogOpener
                                        v-if="props.row"
                                        :file="props.row"
                                    >
                                        Delete File
                                    </DeleteFileDialogOpener>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
            </q-td>
        </template>
        <template #item="props">
            <div class="col-12 file-card-wrapper">
                <q-card
                    flat
                    bordered
                    class="file-card"
                    :class="{ 'file-card--selected': props.selected }"
                    @click="() => onRowClick(undefined, props.row)"
                >
                    <div class="q-pa-sm">
                        <div class="row items-center no-wrap">
                            <q-checkbox
                                v-model="props.selected"
                                dense
                                color="grey-8"
                                class="q-mr-sm"
                                :aria-label="`Select ${props.row.filename}`"
                                @click.stop
                            />
                            <q-icon
                                :name="getIcon(props.row.state)"
                                :color="getColorFileState(props.row.state)"
                                size="20px"
                                class="q-mr-sm"
                                :aria-label="getTooltip(props.row.state)"
                            >
                                <q-tooltip>
                                    {{ getTooltip(props.row.state) }}
                                </q-tooltip>
                            </q-icon>
                            <div class="col file-card__name">
                                {{ props.row.filename }}
                            </div>
                            <q-btn
                                flat
                                round
                                dense
                                icon="sym_o_more_vert"
                                unelevated
                                color="primary"
                                class="cursor-pointer"
                                aria-label="File actions"
                                @click.stop
                            >
                                <q-menu auto-close>
                                    <q-list>
                                        <edit-file-dialog-opener
                                            :file="props.row"
                                        >
                                            <q-item v-ripple clickable>
                                                <q-item-section>
                                                    Edit File
                                                </q-item-section>
                                            </q-item>
                                        </edit-file-dialog-opener>
                                        <q-item
                                            v-ripple
                                            clickable
                                            @click="
                                                () =>
                                                    onRowClick(
                                                        undefined,
                                                        props.row,
                                                    )
                                            "
                                        >
                                            <q-item-section>
                                                View File
                                            </q-item-section>
                                        </q-item>
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                <DeleteFileDialogOpener
                                                    :file="props.row"
                                                >
                                                    Delete File
                                                </DeleteFileDialogOpener>
                                            </q-item-section>
                                        </q-item>
                                    </q-list>
                                </q-menu>
                            </q-btn>
                        </div>

                        <div class="file-card__meta text-caption text-grey-7">
                            {{ props.row.mission.project.name }} /
                            {{ props.row.mission.name }}
                        </div>
                        <div
                            class="row items-center q-gutter-x-sm text-caption text-grey-7"
                        >
                            <span>{{ formatSize(props.row.size) }}</span>
                            <span aria-hidden="true">&middot;</span>
                            <span>
                                {{ formatDate(new Date(props.row.createdAt)) }}
                            </span>
                        </div>
                    </div>
                </q-card>
            </div>
        </template>
        <template #no-data>
            <TableEmptyState
                :is-empty="
                    total === 0 &&
                    !debouncedFilter &&
                    selectedFileTypesFilter.length === 0
                "
                :has-filter="
                    total === 0 &&
                    (!!debouncedFilter || selectedFileTypesFilter.length > 0)
                "
                empty-label="No files found"
                @reset="resetSearch"
            />
        </template>
    </q-table>
</template>

<script setup lang="ts">
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { FilesDto } from '@kleinkram/api-dto/types/file/files.dto';
import {
    keepPreviousData,
    useQuery,
    UseQueryReturnType,
} from '@tanstack/vue-query';
import DeleteFileDialogOpener from 'components/button-wrapper/delete-file-dialog-opener.vue';
import EditFileDialogOpener from 'components/button-wrapper/edit-file-dialog-opener.vue';
import TableEmptyState from 'components/common/table-empty-state.vue';
import FilesFilter from 'components/files/files-filter.vue';
import TitleSection from 'components/title-section.vue';
import { QTable, QTableColumn, useQuasar } from 'quasar';
import { useFileFilter } from 'src/composables/use-file-filter';
import { useHandler } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { formatDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import { getColorFileState, getIcon, getTooltip } from 'src/services/generic';
import { fetchFilteredFiles } from 'src/services/queries/file';
import { computed, Ref, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const $router = useRouter();
const $q = useQuasar();
const tableReference: Ref<QTable | undefined> = ref(undefined);
const handler = useHandler();
handler.value.sortBy = 'file.createdAt';
handler.value.descending = true;
const loading = ref(false);
const selected = ref<FileWithTopicDto[]>([]);

/**
 * Phones render the files as tappable cards, tablets keep the table but drop
 * the secondary columns so that it fits without horizontal scrolling.
 */
const isPhone = computed(() => $q.screen.xs);
const isCompact = computed(() => $q.screen.lt.md);

const sortOptions = [
    { label: 'File name', value: 'file.filename' },
    { label: 'Health', value: 'state' },
    { label: 'Recording date', value: 'file.date' },
    { label: 'Creation date', value: 'file.createdAt' },
    { label: 'Size', value: 'file.size' },
];

const activeSortLabel = computed(
    () =>
        sortOptions.find((option) => option.value === handler.value.sortBy)
            ?.label ?? 'Creation date',
);

function toggleSort(name: string): void {
    handler.value.setDescending(
        handler.value.sortBy === name ? !handler.value.descending : false,
    );
    handler.value.setSort(name);
    handler.value.setPage(1);
}

const filterHook = useFileFilter();
const {
    state,
    startDate,
    endDate,
    selectedFileTypesFilter,
    tagFilterQuery,
    debouncedFilter,
} = filterHook;

const pagination = computed({
    get: () => ({
        page: handler.value.page,
        rowsPerPage: handler.value.take,
        rowsNumber: handler.value.rowsNumber,
        sortBy: handler.value.sortBy,
        descending: handler.value.descending,
    }),
    set: (v) => {
        handler.value.setPage(v.page);
        handler.value.setTake(v.rowsPerPage);
        handler.value.setSort(v.sortBy);
        handler.value.setDescending(v.descending);
    },
});

function resetSearch(): void {
    handler.value.setSearch({ name: '' });
}

function setPagination(update: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter?: any;
    pagination: {
        page: number;
        rowsPerPage: number;
        sortBy: string;
        descending: boolean;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getCellValue: any;
}): void {
    handler.value.setPage(update.pagination.page);
    handler.value.setTake(update.pagination.rowsPerPage);
    handler.value.setSort(update.pagination.sortBy);
    handler.value.setDescending(update.pagination.descending);
}

const queryKeyFiles = computed(() => [
    'Filtered Files',
    handler.value.projectUuid,
    handler.value.missionUuid,
    debouncedFilter,
    startDate,
    endDate,
    state.selectedTopics,
    state.selectedDatatypes,
    state.matchAllTopics,
    state.tagFilter,
    selectedFileTypesFilter,
    handler.value.queryKey,
]);

const { data: _data, isLoading }: UseQueryReturnType<FilesDto, Error> =
    useQuery<FilesDto>({
        queryKey: queryKeyFiles,
        queryFn: () =>
            fetchFilteredFiles({
                filename: debouncedFilter.value,
                projectUUID: handler.value.projectUuid,
                missionUUID: handler.value.missionUuid,
                startDate: startDate.value,
                endDate: endDate.value,
                topics: state.selectedTopics,
                messageDatatypes: state.selectedDatatypes,
                matchAllTopics: state.matchAllTopics,
                fileTypes: selectedFileTypesFilter.value,
                tag: tagFilterQuery.value,
                take: handler.value.take,
                skip: handler.value.skip,
                sort: handler.value.sortBy,
                desc: handler.value.descending,
            }),
        placeholderData: keepPreviousData,
    });

const data = computed(() => (_data.value ? _data.value.data : []));
const total = computed(() => (_data.value ? _data.value.count : 0));
watch(
    () => total.value,
    () => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (data.value && !isLoading.value) {
            handler.value.rowsNumber = total.value;
        }
    },
    { immediate: true },
);

const columns = [
    {
        name: 'state',
        required: true,
        label: 'Health',
        style: 'width: 10px',
        align: 'center',
        sortable: true,
    },
    {
        name: 'project.name',
        required: true,
        label: 'Project',
        align: 'left',
        field: (row: FileWithTopicDto): string => row.mission.project.name,
        format: (value: string): string => value,
        sortable: false,
        style: 'width:  10%; max-width:  10%; min-width: 10%;',
    },
    {
        name: 'mission.name',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: FileWithTopicDto): string => row.mission.name,
        format: (value: string): string => value,
        sortable: false,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'file.filename',
        required: true,
        label: 'File',
        align: 'left',
        field: (row: FileWithTopicDto): string => row.filename,
        format: (value: string): string => value,
        sortable: true,
        style: 'width:  15%; max-width:  15%; min-width: 15%;',
    },
    {
        name: 'file.date',
        required: true,
        label: 'Recoring Date',
        align: 'left',
        field: (row: FileWithTopicDto): Date => row.date,
        format: (value: string): string => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'file.createdAt',
        required: true,
        label: 'Creation Date',
        align: 'left',
        field: (row: FileWithTopicDto): Date => row.createdAt,
        format: (value: string): string => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'Creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: FileWithTopicDto): string => row.creator.name,
        format: (value: string): string => value,
        sortable: false,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'file.size',
        required: true,
        label: 'Size',
        align: 'left',
        field: (row: FileWithTopicDto): number => row.size,
        format: formatSize,
        sortable: true,
    },
    {
        name: 'action',
        required: true,
        label: '',
        align: 'center',
        field: 'Edit',
    },
];

/**
 * Below 1024px only the essentials are shown: project, recording date and
 * creator are dropped so that the remaining columns fit the viewport.
 */
const COMPACT_COLUMN_NAMES = new Set([
    'state',
    'mission.name',
    'file.filename',
    'file.createdAt',
    'file.size',
    'action',
]);

const visibleColumns = computed(() =>
    isCompact.value
        ? columns.filter((column) => COMPACT_COLUMN_NAMES.has(column.name))
        : columns,
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onRowClick = async (_: any, row: FileWithTopicDto): Promise<void> => {
    await $router.push({
        name: ROUTES.FILE.routeName,
        params: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            file_uuid: row.uuid,
            missionUuid: row.mission.uuid,
            projectUuid: row.mission.project.uuid,
        },
    });
};
</script>

<style scoped>
.file-card-wrapper {
    padding: 4px 0;
}

.file-card {
    border-radius: 4px;
}

.file-card--selected {
    background-color: #e7efff;
}

.file-card__name {
    min-width: 0;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    overflow: hidden;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.file-card__meta {
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* The card list is a plain column, no inner scroll container */
.files-table--grid :deep(.q-table__grid-content) {
    margin: 0;
}

/*
 * The global stylesheet already lets the pagination bar wrap on phones; it
 * only needs slightly smaller text and finger-sized page buttons here.
 */
@media (max-width: 599px) {
    :deep(.q-table__bottom) {
        column-gap: 8px;
        font-size: 12px;
    }

    :deep(.q-table__bottom .q-btn) {
        min-height: 36px;
        min-width: 36px;
    }
}
</style>
