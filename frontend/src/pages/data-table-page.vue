<template>
    <title-section title="Datatable" />

    <FilesFilter :use-filter="filterHook" />

    <table-selection-bar
        noun="file"
        :count="selected.length"
        @clear="clearSelection"
    />

    <!--
        The card list has no column headers, so phones get an explicit sort
        control.
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
        :columns="columnLayout.columns as QTableColumn<FileWithTopicDto>[]"
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
        <template #header-cell="props">
            <table-header-cell :cell-props="props" :layout="columnLayout" />
        </template>
        <template #header-cell-action="props">
            <q-th :props="props">
                <table-column-settings :layout="columnLayout" />
            </q-th>
        </template>
        <template #body-cell-categories="props">
            <q-td :props="props">
                <q-chip
                    v-for="category in sortedCategories(props.row)"
                    :key="category.uuid"
                    :label="category.name"
                    :color="hashUUIDtoColor(category.uuid)"
                    text-color="white"
                    dense
                    class="q-ml-none q-mr-xs"
                >
                    <q-tooltip v-if="category.description">
                        {{ category.description }}
                    </q-tooltip>
                </q-chip>
            </q-td>
        </template>
        <template #body-cell-filename="props">
            <q-td :props="props">
                <router-link
                    :to="fileRoute(props.row)"
                    class="kk-row-link"
                    @click.stop
                >
                    {{ props.row.filename }}
                </router-link>
            </q-td>
        </template>

        <template #body-cell-state="props">
            <q-td :props="props">
                <q-icon
                    :name="getIcon(props.row.state)"
                    :color="getColorFileState(props.row.state)"
                    size="20px"
                >
                    <q-tooltip>{{
                        getTooltip(props.row.state, props.row.stateComment)
                    }}</q-tooltip>
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
                                @click="() => openFile(props.row)"
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
                                            @click="() => openFile(props.row)"
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
import type { CategoryDto } from '@kleinkram/api-dto/types/category.dto';
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { FilesDto } from '@kleinkram/api-dto/types/file/files.dto';
import {
    keepPreviousData,
    useQuery,
    UseQueryReturnType,
} from '@tanstack/vue-query';
import DeleteFileDialogOpener from 'components/button-wrapper/delete-file-dialog-opener.vue';
import EditFileDialogOpener from 'components/button-wrapper/edit-file-dialog-opener.vue';
import TableColumnSettings from 'components/common/table-columns/table-column-settings.vue';
import TableHeaderCell from 'components/common/table-columns/table-header-cell.vue';
import TableEmptyState from 'components/common/table-empty-state.vue';
import TableSelectionBar from 'components/common/table-selection-bar.vue';
import FilesFilter from 'components/files/files-filter.vue';
import TitleSection from 'components/title-section.vue';
import { QTable, QTableColumn, useQuasar } from 'quasar';
import { useFileFilter } from 'src/composables/use-file-filter';
import { useRowActivation } from 'src/composables/use-row-activation';
import { useTableColumns } from 'src/composables/use-table-columns';
import { useHandler } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { formatDate, formatDuration } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import {
    getColorFileState,
    getIcon,
    getTooltip,
    hashUUIDtoColor,
} from 'src/services/generic';
import { fetchFilteredFiles } from 'src/services/queries/file';
import { computed, Ref, ref, watch } from 'vue';
import { RouteLocationRaw, useRoute, useRouter } from 'vue-router';

const $router = useRouter();
const $route = useRoute();
const $q = useQuasar();
const tableReference: Ref<QTable | undefined> = ref(undefined);
const handler = useHandler();

// Files are listed newest recording first. A sort pinned in the URL (a shared
// deep link, a reload after clicking a column header) takes precedence.
if (!$route.query.sortBy) {
    handler.value.sortBy = 'file.date';
    handler.value.descending = true;
}
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
    { label: 'Project', value: 'project.name' },
    { label: 'Mission', value: 'mission.name' },
    { label: 'Creator', value: 'creator.name' },
    { label: 'Recording date', value: 'file.date' },
    { label: 'Creation date', value: 'file.createdAt' },
    { label: 'Size', value: 'file.size' },
];

const activeSortLabel = computed(
    () =>
        sortOptions.find((option) => option.value === handler.value.sortBy)
            ?.label ?? 'Recording date',
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
    metadataFilterQuery,
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
    state.metadataFilter,
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
                metadataByTypeUuid: metadataFilterQuery.value,
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
        sortable: true,
        style: 'width:  10%; max-width:  10%; min-width: 10%;',
    },
    {
        name: 'mission.name',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: FileWithTopicDto): string => row.mission.name,
        format: (value: string): string => value,
        sortable: true,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'file.filename',
        alwaysVisible: true,
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
        classes: 'kk-nowrap',
        label: 'Recording Date',
        align: 'left',
        field: (row: FileWithTopicDto): Date => row.date,
        format: (value: string): string => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'file.createdAt',
        required: true,
        classes: 'kk-nowrap',
        label: 'Creation Date',
        align: 'left',
        field: (row: FileWithTopicDto): Date => row.createdAt,
        format: (value: string): string => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'creator.name',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: FileWithTopicDto): string => row.creator.name,
        format: (value: string): string => value,
        sortable: true,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'file.size',
        required: true,
        label: 'Size',
        align: 'right',
        classes: 'kk-num',
        headerClasses: 'kk-num',
        field: (row: FileWithTopicDto): number => row.size,
        format: formatSize,
        sortable: true,
    },
    // Off by default, can be added in the column settings. Not sortable: the
    // backend only orders by the columns above.
    {
        name: 'type',
        label: 'Type',
        align: 'left',
        defaultHidden: true,
        field: (row: FileWithTopicDto): string => row.type,
    },
    {
        name: 'categories',
        label: 'Categories',
        align: 'left',
        defaultHidden: true,
    },
    {
        name: 'duration',
        label: 'Duration',
        align: 'right',
        classes: 'kk-num',
        headerClasses: 'kk-num',
        defaultHidden: true,
        field: (row: FileWithTopicDto): number | null => row.durationSeconds,
        format: (value: number | null): string =>
            value === null ? '' : formatDuration(value),
    },
    {
        name: 'recordingStart',
        label: 'Recording Start',
        align: 'left',
        classes: 'kk-nowrap',
        defaultHidden: true,
        field: (row: FileWithTopicDto): Date | null => row.recordingStartDate,
        format: (value: string | null): string =>
            value ? formatDate(new Date(value)) : '',
    },
    {
        name: 'recordingEnd',
        label: 'Recording End',
        align: 'left',
        classes: 'kk-nowrap',
        defaultHidden: true,
        field: (row: FileWithTopicDto): Date | null => row.recordingEndDate,
        format: (value: string | null): string =>
            value ? formatDate(new Date(value)) : '',
    },
    {
        name: 'hash',
        label: 'Hash',
        align: 'left',
        classes: 'kk-nowrap',
        defaultHidden: true,
        field: (row: FileWithTopicDto): string => row.hash ?? '',
    },
    {
        name: 'action',
        configurable: false,
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
const columnLayout = useTableColumns('datatable', columns, {
    compact: isCompact,
    compactColumns: [
        'state',
        'mission.name',
        'file.filename',
        'file.createdAt',
        'file.size',
        'action',
    ],
});

function sortedCategories(file: FileWithTopicDto): CategoryDto[] {
    return file.categories.toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Route to a file, shared by the row click and the name link.
 */
function fileRoute(row: FileWithTopicDto): RouteLocationRaw {
    return {
        name: ROUTES.FILE.routeName,
        params: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            file_uuid: row.uuid,
            missionUuid: row.mission.uuid,
            projectUuid: row.mission.project.uuid,
        },
    };
}

const openFile = async (row: FileWithTopicDto): Promise<void> => {
    await $router.push(fileRoute(row));
};

/**
 * Navigates while nothing is selected, toggles the row once something is.
 * See use-row-activation for why that is safe here.
 */
const { onRowClick } = useRowActivation(selected, openFile);

function clearSelection(): void {
    selected.value = [];
}
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
