<template>
    <title-section title="Datatable" />

    <div
        class="q-pa-md bg-grey-1 rounded-borders q-mb-md border-grey-3"
        style="border: 1px solid #e0e0e0"
    >
        <div class="row q-col-gutter-sm q-mb-sm">
            <div class="col-12 col-sm-6 col-md-3">
                <q-input
                    v-model="startDates"
                    filled
                    dense
                    outlined
                    bg-color="white"
                    label="Start Date"
                    @clear="resetStartDate"
                >
                    <template #append>
                        <q-icon name="sym_o_event" class="cursor-pointer">
                            <q-popup-proxy
                                cover
                                transition-show="scale"
                                transition-hide="scale"
                            >
                                <q-date v-model="startDates" :mask="dateMask">
                                    <div class="row items-center justify-end">
                                        <q-btn
                                            v-close-popup
                                            label="Close"
                                            color="primary"
                                            flat
                                        />
                                    </div>
                                </q-date>
                            </q-popup-proxy>
                        </q-icon>
                    </template>
                </q-input>
            </div>

            <div class="col-12 col-sm-6 col-md-3">
                <q-input
                    v-model="endDates"
                    filled
                    dense
                    outlined
                    bg-color="white"
                    label="End Date"
                    @clear="resetEndDate"
                >
                    <template #append>
                        <q-icon name="sym_o_event" class="cursor-pointer">
                            <q-popup-proxy
                                cover
                                transition-show="scale"
                                transition-hide="scale"
                            >
                                <q-date v-model="endDates" :mask="dateMask">
                                    <div class="row items-center justify-end">
                                        <q-btn
                                            v-close-popup
                                            label="Close"
                                            color="primary"
                                            flat
                                        />
                                    </div>
                                </q-date>
                            </q-popup-proxy>
                        </q-icon>
                    </template>
                </q-input>
            </div>

            <div class="col-12 col-md-6">
                <ScopeSelector
                    layout="row"
                    :show-labels="true"
                    class="full-width"
                />
                <q-tooltip v-if="!handler.projectUuid" self="bottom middle">
                    Please select a project first
                </q-tooltip>
            </div>
        </div>

        <div class="row q-col-gutter-sm items-center">
            <div class="col-12 col-sm-4 col-md-2">
                <file-type-selector
                    ref="fileTypeSelectorReference"
                    v-model="fileTypeFilter"
                />
            </div>

            <div class="col-12 col-sm-8 col-md-5">
                <div class="row no-wrap q-col-gutter-xs">
                    <div class="col-auto">
                        <q-btn-dropdown
                            unelevated
                            outline
                            color="grey-4"
                            text-color="black"
                            dense
                            class="bg-white full-height"
                            no-caps
                        >
                            <template #label>
                                <span class="text-weight-regular">{{
                                    matchAllTopics ? 'And' : 'Or'
                                }}</span>
                            </template>
                            <q-list>
                                <q-item clickable @click="useAndTopicFilter">
                                    <q-item-section>And</q-item-section>
                                </q-item>
                                <q-item clickable @click="useOrTopicFilter">
                                    <q-item-section>Or</q-item-section>
                                </q-item>
                            </q-list>
                        </q-btn-dropdown>
                    </div>
                    <div class="col">
                        <q-select
                            v-model="selectedTopics"
                            label="Filter by Topics"
                            use-input
                            input-debounce="20"
                            outlined
                            dense
                            bg-color="white"
                            multiple
                            use-chips
                            :options="displayedTopics"
                            emit-value
                            map-options
                            class="full-width"
                            @filter="filterFunction"
                        />
                    </div>
                </div>
            </div>

            <div class="col-12 col-sm-8 col-md-3">
                <q-input
                    v-model="filter"
                    outlined
                    dense
                    bg-color="white"
                    debounce="300"
                    clearable
                    placeholder="Search Filename"
                    class="full-width"
                >
                    <template #append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>
            </div>

            <div class="col-12 col-sm-4 col-md-2 text-right">
                <div class="row justify-end q-gutter-x-sm">
                    <q-btn
                        v-if="tagFilter"
                        flat
                        dense
                        round
                        icon="sym_o_sell"
                        color="primary"
                        @click="openTagFilterDialog"
                    >
                        <q-tooltip>Advanced Tag Filter</q-tooltip>
                        <q-badge
                            v-if="Object.values(tagFilter).length > 0"
                            color="red"
                            floating
                        >
                            {{ Object.values(tagFilter).length }}
                        </q-badge>
                    </q-btn>

                    <q-btn
                        unelevated
                        color="grey-4"
                        text-color="black"
                        label="Reset"
                        icon="sym_o_refresh"
                        no-caps
                        class="full-height"
                        @click="resetFilter"
                    />
                </div>
            </div>
        </div>
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
        :columns="columns as any"
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
    </q-table>
</template>

<script setup lang="ts">
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { FilesDto } from '@kleinkram/api-dto/types/file/files.dto';
import { FileType } from '@kleinkram/shared';
import {
    keepPreviousData,
    useQuery,
    UseQueryReturnType,
} from '@tanstack/vue-query';
import DeleteFileDialogOpener from 'components/button-wrapper/delete-file-dialog-opener.vue';
import EditFileDialogOpener from 'components/button-wrapper/edit-file-dialog-opener.vue';
import ScopeSelector from 'components/common/scope-selector.vue';
import FileTypeSelector from 'components/file-type-selector.vue';
import TitleSection from 'components/title-section.vue';
import { QTable, useQuasar } from 'quasar';
import TagFilter from 'src/dialogs/tag-filter.vue';
import { useHandler } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { dateMask, formatDate, parseDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import { getColorFileState, getIcon, getTooltip } from 'src/services/generic';
import { fetchFilteredFiles } from 'src/services/queries/file';
import { allTopicsNames } from 'src/services/queries/topic';
import { FileTypeOption } from 'src/types/file-type-option';
import { computed, Ref, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const $router = useRouter();
const $q = useQuasar();
const tableReference: Ref<QTable | undefined> = ref(undefined);
const handler = useHandler();
handler.value.sortBy = 'file.createdAt';
handler.value.descending = true;
const loading = ref(false);
const filter = ref('');
const start = new Date(0);
const end = new Date();
const startDates = ref(formatDate(start));
const endDates = ref(formatDate(end));
const fileTypeFilter = ref<FileTypeOption[] | undefined>(undefined);
const fileTypeSelectorReference = ref<
    { setAll?: (value: boolean) => void } | undefined
>(undefined);
const selected = ref([]);
const { data: allTopics } = useQuery<string[]>({
    queryKey: ['topics'],
    queryFn: allTopicsNames,
});
const displayedTopics = ref(allTopics.value);
const selectedTopics = ref([]);
const matchAllTopics = ref(false);

const tagFilter: Ref<Record<string, { name: string; value: string }>> = ref({});
end.setHours(23, 59, 59, 999);
const startDate = computed(() => parseDate(startDates.value));
const endDate = computed(() => parseDate(endDates.value));
const selectedFileTypesFilter = computed<FileType[]>(() => {
    const list = fileTypeFilter.value ?? [];
    return list
        .filter((option) => option.value)
        .map((option) => option.name) as FileType[];
});

const pagination = computed(() => {
    return {
        page: handler.value.page,
        rowsPerPage: handler.value.take,
        rowsNumber: handler.value.rowsNumber,
        sortBy: handler.value.sortBy,
        descending: handler.value.descending,
    };
});

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
    filter,
    startDate,
    endDate,
    selectedTopics,
    matchAllTopics,
    tagFilter,
    selectedFileTypesFilter,
    handler.value.queryKey,
]);

const tagFilterQuery = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};
    for (const key of Object.keys(tagFilter.value)) {
        query[key] = tagFilter.value[key] ?? '';
    }
    return query;
});

const { data: _data, isLoading }: UseQueryReturnType<FilesDto, Error> =
    useQuery<FilesDto>({
        queryKey: queryKeyFiles,
        queryFn: () =>
            fetchFilteredFiles(
                filter.value,
                handler.value.projectUuid,
                handler.value.missionUuid,
                startDate.value,
                endDate.value,
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                selectedTopics.value ?? [],
                [],
                matchAllTopics.value,
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                selectedFileTypesFilter.value ?? ([] as FileType[]),
                tagFilterQuery.value,
                handler.value.take,
                handler.value.skip,
                handler.value.sortBy,
                handler.value.descending,
            ),
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

function openTagFilterDialog(): void {
    $q.dialog({
        title: 'Filter by Metadata',
        component: TagFilter,
        componentProps: { tagValues: tagFilter.value },
    }).onOk((_tagFilter) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        tagFilter.value = _tagFilter;
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterFunction(value: string, update: any): void {
    if (value === '') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        update(() => {
            displayedTopics.value = allTopics.value;
        });
        return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    update(() => {
        if (!allTopics.value) return;
        const needle = value.toLowerCase();
        displayedTopics.value = allTopics.value.filter((v) =>
            v.toLowerCase().includes(needle),
        );
    });
}
function useAndTopicFilter(): void {
    matchAllTopics.value = true;
}

function useOrTopicFilter(): void {
    matchAllTopics.value = false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onRowClick = async (_: any, row: any): Promise<void> => {
    await $router.push({
        name: ROUTES.FILE.routeName,
        params: {
            // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            file_uuid: row.uuid,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            missionUuid: row.mission.uuid,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            projectUuid: row.mission.project.uuid,
        },
    });
};

function resetStartDate(): void {
    startDates.value = formatDate(start);
}

function resetEndDate(): void {
    endDates.value = formatDate(end);
}

function resetFilter(): void {
    handler.value.setProjectUUID(undefined);
    handler.value.setMissionUUID(undefined);
    handler.value.setSearch({ name: '' });
    filter.value = '';
    selectedTopics.value = [];
    matchAllTopics.value = false;
    if (
        fileTypeSelectorReference.value &&
        typeof fileTypeSelectorReference.value.setAll === 'function'
    ) {
        fileTypeSelectorReference.value.setAll(true);
    } else if (fileTypeFilter.value) {
        fileTypeFilter.value = fileTypeFilter.value.map((it) => ({
            ...it,
            value: true,
        }));
    }
    tagFilter.value = {};
    resetStartDate();
    resetEndDate();
}
</script>
