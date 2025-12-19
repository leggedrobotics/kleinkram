<template>
    <title-section title="Datatable" />

    <FilesFilter :use-filter="filterHook" />

    <q-table
        ref="tableReference"
        v-model:pagination="pagination"
        v-model:selected="selected"
        flat
        bordered
        separator="none"
        :rows-per-page-options="[5, 10, 20, 50, 100]"
        :rows="data"
        :columns="columns as QTableColumn<FileWithTopicDto>[]"
        row-key="uuid"
        :loading="loading"
        selection="multiple"
        binary-state-sort
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
import { QTable, QTableColumn } from 'quasar';
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
const tableReference: Ref<QTable | undefined> = ref(undefined);
const handler = useHandler();
handler.value.sortBy = 'file.createdAt';
handler.value.descending = true;
const loading = ref(false);
const selected = ref([]);

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
