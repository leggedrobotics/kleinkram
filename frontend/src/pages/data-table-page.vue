<template>
    <title-section title="Datatable" />

    <div class="row">
        <div class="col-4 flex">
            <q-input
                v-model="startDates"
                filled
                dense
                outlined
                clearable
                placeholder="Select start date"
                class="q-pa-sm"
                style="width: 50%"
                @clear="resetStartDate"
            >
                <template #prepend>
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
            <p class="flex flex-center" style="margin-bottom: 0; width: 0">-</p>
            <q-input
                v-model="endDates"
                filled
                dense
                clearable
                placeholder="Select start date"
                class="q-pa-sm"
                style="width: 50%"
                @clear="resetEndDate"
            >
                <template #prepend>
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
        <div class="col-4 flex q-pa-sm">
            <q-btn-dropdown
                v-model="dd_open_projects"
                :label="selected_project?.name || 'Filter by Project'"
                dense
                clearable
                flat
                class="full-width button-border"
            >
                <q-list>
                    <q-item
                        v-for="project in projects"
                        :key="project.uuid"
                        clickable
                        @click="
                            () => {
                                handler.setProjectUUID(project.uuid);
                                dd_open_projects = false;
                            }
                        "
                    >
                        <q-item-section>
                            <q-item-label>{{ project.name }}</q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-btn-dropdown>
        </div>
        <div class="col-4 flex q-pa-sm">
            <q-tooltip v-if="!handler.projectUuid" self="bottom middle">
                Please select a project first
            </q-tooltip>
            <q-btn-dropdown
                v-model="dd_open_missions"
                :label="selected_mission?.name || 'Filter by Mission'"
                dense
                clearable
                flat
                class="full-width button-border"
                :disable="!handler.projectUuid"
            >
                <q-list>
                    <q-item
                        v-for="mission in missions"
                        :key="mission.uuid"
                        clickable
                        @click="
                            () => {
                                handler.setMissionUUID(mission.uuid);
                                dd_open_missions = false;
                            }
                        "
                    >
                        <q-item-section>
                            <q-item-label>{{ mission.name }}</q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-btn-dropdown>
        </div>
    </div>
    <div class="row">
        <div class="col-2 q-pa-sm">
            <q-btn-dropdown
                clearable
                dense
                flat
                class="full-width full-height button-border"
                :label="'File Types: ' + selectedFileTypes"
            >
                <q-list style="width: 100%">
                    <q-item
                        v-for="(option, index) in fileTypeFilter"
                        :key="index"
                    >
                        <q-item-section class="items-center">
                            <q-toggle
                                :model-value="fileTypeFilter[index].value"
                                :label="option.name"
                                @click="() => onFileTypeClicked(index)"
                            />
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-btn-dropdown>
        </div>
        <div class="col-2 q-pa-sm" style="margin: 0">
            <q-input
                v-model="filter"
                outlined
                dense
                debounce="300"
                clearable
                placeholder="Filter by Filename"
                class="full-width"
            />
        </div>

        <div class="col-4 q-pa-sm" style="display: flex; align-items: center">
            <q-select
                v-model="selectedTopics"
                label="Select Topics"
                use-input
                input-debounce="20"
                outlined
                dense
                clearable
                multiple
                use-chips
                :options="displayedTopics"
                emit-value
                map-options
                class="full-width"
                style="
                    padding-right: 5px;
                    max-height: 70px;
                    overflow: scroll;
                    scrollbar-width: none;
                "
                @filter="filterFunction"
            />
            <q-btn-dropdown
                dense
                flat
                class="full-height button-border"
                style="min-width: 60px"
            >
                <template #label>
                    {{ and_or ? 'And' : 'Or' }}
                </template>
                <q-list>
                    <q-item
                        v-for="(item, index) in ['And', 'Or']"
                        :key="index"
                        clickable
                        @click="() => (and_or = item === 'And')"
                    >
                        <q-item-section>
                            {{ item }}
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-btn-dropdown>
        </div>

        <div class="col-3 q-pa-sm">
            <q-btn
                v-if="tagFilter"
                flat
                text-color="black"
                color="primary"
                label="Tags"
                icon="sym_o_sell"
                class="full-width button-border full-height"
                @click="openTagFilterDialog"
            >
                <q-chip
                    v-for="value in Object.values(tagFilter)"
                    :key="
                        // @ts-ignore
                        value?.name
                    "
                    dense
                >
                    {{
                        // @ts-ignore
                        value?.name
                    }}:
                    {{
                        // @ts-ignore
                        value?.value
                    }}
                </q-chip>
            </q-btn>
        </div>
        <div class="col-1 q-pa-sm">
            <q-btn
                flat
                text-color="black"
                label="Reset"
                icon="sym_o_clear"
                class="full-width button-border full-height"
                @click="resetFilter"
            />
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
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
                >
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
                >
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
import { computed, Ref, ref, watch } from 'vue';
import { QTable, useQuasar } from 'quasar';
import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';

import { dateMask, formatDate, parseDate } from '../services/date-formating';
import ROUTES from 'src/router/routes';
import { formatSize } from '../services/general-formatting';
import { allTopicsNames } from 'src/services/queries/topic';
import { fetchOverview } from 'src/services/queries/file';
import TagFilter from '../dialogs/tag-filter.vue';
import {
    useFilteredProjects,
    useHandler,
    useMissionsOfProjectMinimal,
} from '../hooks/query-hooks';
import { getColorFileState, getIcon, getTooltip } from 'src/services/generic';
import { useRouter } from 'vue-router';
import { FlatMissionDto } from '@api/types/mission/mission.dto';
import { FileWithTopicDto } from '@api/types/file/file.dto';
import { FilesDto } from '@api/types/file/files.dto';

import { ProjectWithMissionCountDto } from '@api/types/project/project-with-mission-count.dto';
import DeleteFileDialogOpener from '@components/button-wrapper/delete-file-dialog-opener.vue';
import TitleSection from '@components/title-section.vue';
import EditFileDialogOpener from '@components/button-wrapper/edit-file-dialog-opener.vue';

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

const fileTypeFilter = ref([
    { name: 'Bag', value: false },
    { name: 'MCAP', value: true },
]);

const selected_project = computed(() =>
    projects.value.find(
        (project: ProjectWithMissionCountDto) =>
            project.uuid === handler.value.projectUuid,
    ),
);

const selected_mission = computed(() =>
    missions.value.find(
        (mission: FlatMissionDto) => mission.uuid === handler.value.missionUuid,
    ),
);

const dd_open_projects = ref(false);
const dd_open_missions = ref(false);
const selected = ref([]);

// Fetch projects
const projectsReturn = useFilteredProjects(500, 0, 'name', false);
const projects = computed(() =>
    projectsReturn.data.value ? projectsReturn.data.value.data : [],
);

// Fetch missions
const { data: _missions } = useMissionsOfProjectMinimal(
    (handler.value.projectUuid && '') as string,
    500,
    0,
);
const missions = computed(() => (_missions.value ? _missions.value.data : []));

// Fetch topics
const { data: allTopics } = useQuery<string[]>({
    queryKey: ['topics'],
    queryFn: allTopicsNames,
});
const displayedTopics = ref(allTopics.value);
const selectedTopics = ref([]);

const and_or = ref(false);
const tagFilter: Ref<Record<string, { name: string; value: string }>> = ref({});

end.setHours(23, 59, 59, 999);

const startDate = computed(() => parseDate(startDates.value));
const endDate = computed(() => parseDate(endDates.value));

const selectedFileTypesFilter = computed(() => {
    return fileTypeFilter.value
        .filter((item) => item.value)
        .map((item) => item.name);
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
    filter?: any;
    pagination: {
        page: number;
        rowsPerPage: number;
        sortBy: string;
        descending: boolean;
    };
    getCellValue: any;
}) {
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
    and_or,
    tagFilter,
    selectedFileTypesFilter,
    handler.value.queryKey,
]);

const tagFilterQuery = computed(() => {
    const query: Record<string, any> = {};
    for (const key of Object.keys(tagFilter.value)) {
        query[key] = tagFilter.value[key] ?? '';
    }
    return query;
});

const selectedFileTypes = computed(() => {
    return fileTypeFilter.value
        .filter((item) => item.value)
        .map((item) => item.name)
        .join(' & ');
});

const { data: _data, isLoading }: UseQueryReturnType<FilesDto, Error> =
    useQuery<FilesDto>({
        queryKey: queryKeyFiles,
        queryFn: () =>
            fetchOverview(
                filter.value,
                handler.value.projectUuid,
                handler.value.missionUuid,
                startDate.value,
                endDate.value,
                selectedTopics.value || [],
                and_or.value,
                selectedFileTypesFilter.value as ('mcap' | 'bag')[],
                tagFilterQuery.value,
                handler.value.take,
                handler.value.skip,
                handler.value.sortBy,
                handler.value.descending,
            ),
    });
const data = computed(() => (_data.value ? _data.value.data : []));
const total = computed(() => (_data.value ? _data.value.count : 0));

watch(
    () => total.value,
    () => {
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
        field: (row: FileWithTopicDto) => row.mission.project.name,
        format: (value: string) => value,
        sortable: false,
        style: 'width:  10%; max-width:  10%; min-width: 10%;',
    },
    {
        name: 'mission.name',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: FileWithTopicDto) => row.mission.name,
        format: (value: string) => value,
        sortable: false,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'file.filename',
        required: true,
        label: 'File',
        align: 'left',
        field: (row: FileWithTopicDto) => row.filename,
        format: (value: string) => value,
        sortable: true,
        style: 'width:  15%; max-width:  15%; min-width: 15%;',
    },
    {
        name: 'file.date',
        required: true,
        label: 'Recoring Date',
        align: 'left',
        field: (row: FileWithTopicDto) => row.date,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'file.createdAt',
        required: true,
        label: 'Creation Date',
        align: 'left',
        field: (row: FileWithTopicDto) => row.createdAt,
        format: (value: string) => formatDate(new Date(value)),
        sortable: true,
    },
    {
        name: 'Creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: FileWithTopicDto) => row.creator.name,
        format: (value: string) => value,
        sortable: false,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'file.size',
        required: true,
        label: 'Size',
        align: 'left',
        field: (row: FileWithTopicDto) => row.size,
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

function openTagFilterDialog() {
    $q.dialog({
        title: 'Filter by Metadata',
        component: TagFilter,
        componentProps: {
            tagValues: tagFilter.value,
        },
    }).onOk((_tagFilter) => {
        tagFilter.value = _tagFilter;
    });
}

function filterFunction(value: string, update: any) {
    if (value === '') {
        update(() => {
            displayedTopics.value = allTopics.value;
        });
        return;
    }
    update(() => {
        if (!allTopics.value) return;
        const needle = value.toLowerCase();
        displayedTopics.value = allTopics.value.filter((v) =>
            v.toLowerCase().includes(needle),
        );
    });
}

const onRowClick = async (_: any, row: any) => {
    await $router.push({
        name: ROUTES.FILE.routeName,
        params: {
            file_uuid: row.uuid,
            mission_uuid: row.mission.uuid,
            project_uuid: row.mission.project.uuid,
        },
    });
};

function onFileTypeClicked(index: number) {
    fileTypeFilter.value[index].value = !fileTypeFilter.value[index].value;
    if (!fileTypeFilter.value[0].value && !fileTypeFilter.value[1].value) {
        fileTypeFilter.value[1 - index].value = true;
    }
}

function resetStartDate() {
    startDates.value = formatDate(start);
}

function resetEndDate() {
    endDates.value = formatDate(end);
}

function resetFilter() {
    handler.value.setProjectUUID(undefined);
    handler.value.setMissionUUID(undefined);
    handler.value.setSearch({ name: '' });
    filter.value = '';
    selectedTopics.value = [];
    and_or.value = false;
    fileTypeFilter.value = [
        { name: 'Bag', value: false },
        { name: 'MCAP', value: true },
    ];
    tagFilter.value = {};
    resetStartDate();
    resetEndDate();
}
</script>
<style scoped></style>
