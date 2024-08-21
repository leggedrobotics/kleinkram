<template>
    <title-section title="Datatable"></title-section>

    <div class="row">
        <div class="col-4 flex">
            <q-input
                filled
                v-model="startDates"
                dense
                outlined
                clearable
                placeholder="Select start date"
                class="q-pa-sm"
                style="width: 49%"
                @clear="resetStartDate"
            >
                <template v-slot:prepend>
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
            <p class="flex flex-center" style="margin-bottom: 0">-</p>
            <q-input
                filled
                v-model="endDates"
                dense
                outlined
                clearable
                placeholder="Select start date"
                class="q-pa-sm"
                style="width: 49%"
                @clear="resetEndDate"
            >
                <template v-slot:prepend>
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
                outline
                dense
                clearable
                class="full-width"
            >
                <q-list>
                    <q-item
                        v-for="project in projects"
                        :key="project.uuid"
                        clickable
                        @click="
                            handler.setProjectUUID(project.uuid);
                            dd_open_projects = false;
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
            <q-btn-dropdown
                v-model="dd_open_missions"
                :label="selected_mission?.name || 'Filter by Mission'"
                outline
                dense
                clearable
                class="full-width"
            >
                <q-list>
                    <q-item
                        v-for="mission in missions"
                        :key="mission.uuid"
                        clickable
                        @click="
                            handler.setMissionUUID(mission.uuid);
                            dd_open_missions = false;
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
                outline
                class="full-width full-height"
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
                                @click="onFileTypeClicked(index)"
                                :label="option.name"
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
                @filter="filterFn"
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
                style="padding-right: 5px"
            >
            </q-select>
            <q-btn-dropdown
                dense
                outline
                class="full-height"
                style="min-width: 60px"
            >
                <template v-slot:label>
                    {{ and_or ? 'And' : 'Or' }}
                </template>
                <q-list>
                    <q-item
                        v-for="(item, index) in ['And', 'Or']"
                        clickable
                        :key="index"
                        @click="and_or = item === 'And'"
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
                outline
                text-color="black"
                color="primary"
                label="Tags"
                icon="sym_o_filter_list"
                class="full-width"
                @click="openTagFilterDialog"
            >
                <q-chip
                    v-if="tagFilter"
                    v-for="value in Object.values(tagFilter)"
                    dense
                >
                    {{ value.name }}: {{ value.value }}
                </q-chip>
            </q-btn>
        </div>
        <div class="col-1 q-pa-sm">
            <q-btn
                outline
                text-color="black"
                label="Reset"
                icon="sym_o_clear"
                class="full-width"
                @click="resetFilter"
            />
        </div>
    </div>

    <q-table
        flat
        bordered
        separator="none"
        ref="tableRef"
        v-model:pagination="pagination"
        v-model:selected="selected"
        :rows-per-page-options="[5, 10, 20, 50, 100]"
        :rows="data"
        :columns="columns"
        row-key="uuid"
        :loading="loading"
        selection="multiple"
        @row-click="onRowClick"
        @request="setPagination"
    >
        <template v-slot:body-cell="props">
            <q-td :props="props" :style="getTentativeRowStyle(props.row)">
                <q-tooltip v-if="props.row.tentative"
                    >This file has not yet completed uploading
                </q-tooltip>

                {{ props.value }}
            </q-td>
        </template>
        <template v-slot:body-cell-action="props">
            <q-td :props="props" :style="getTentativeRowStyle(props.row)">
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
                            <q-item
                                clickable
                                v-ripple
                                @click="() => openQDialog(props.row)"
                                :style="
                                    props.row.tentative
                                        ? 'pointer-events: none'
                                        : ''
                                "
                                :disabled="props.row.tentative"
                            >
                                <q-item-section>Edit File</q-item-section>
                            </q-item>
                            <q-item
                                clickable
                                v-ripple
                                @click="
                                    () =>
                                        $routerService?.routeTo(ROUTES.FILE, {
                                            uuid: props.row.uuid,
                                        })
                                "
                            >
                                <q-item-section>View File</q-item-section>
                            </q-item>
                            <q-item clickable v-ripple>
                                <q-item-section>
                                    <DeleteFileDialogOpener
                                        :file="props.row"
                                        v-if="props.row"
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
import { computed, inject, Ref, ref, watch } from 'vue';
import { QTable, useQuasar } from 'quasar';
import { useQuery } from '@tanstack/vue-query';

import EditMission from 'components/EditFile.vue';
import { dateMask, formatDate, parseDate } from 'src/services/dateFormating';
import ROUTES from 'src/router/routes';
import RouterService from 'src/services/routerService';
import { formatSize } from 'src/services/generalFormatting';
import { Project } from 'src/types/Project';
import { Mission } from 'src/types/Mission';
import { FileEntity } from 'src/types/FileEntity';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProject } from 'src/services/queries/mission';
import { allTopicsNames } from 'src/services/queries/topic';
import { fetchOverview } from 'src/services/queries/file';
import TagFilter from 'src/dialogs/TagFilter.vue';
import { useHandler } from 'src/hooks/customQueryHooks';
import DeleteFileDialogOpener from 'components/buttonWrapper/DeleteFileDialogOpener.vue';
import { getTentativeRowStyle } from 'src/services/generic';
import TitleSection from 'components/TitleSection.vue';

const $routerService: RouterService | undefined = inject('$routerService');

const $q = useQuasar();
const tableRef: Ref<QTable | null> = ref(null);

const handler = useHandler();
handler.value.sortBy = 'file.date';

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
        (project: Project) => project.uuid === handler.value.project_uuid,
    ),
);

const selected_mission = computed(() =>
    missions.value.find(
        (mission: Mission) => mission.uuid === handler.value.mission_uuid,
    ),
);

const dd_open_projects = ref(false);
const dd_open_missions = ref(false);
const selected = ref([]);

// Fetch projects
const projectsReturn = useQuery<[Project[], number]>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name', false),
});
const projects = computed(() =>
    projectsReturn.data.value ? projectsReturn.data.value[0] : [],
);

// Fetch missions
const queryKeyMissions = computed(() => [
    'missions',
    handler.value.project_uuid,
]);
const { data: _missions, refetch } = useQuery<[Mission[], number]>({
    queryKey: queryKeyMissions,
    queryFn: () => missionsOfProject(handler.value.project_uuid || '', 500, 0),
});
const missions = computed(() => (_missions.value ? _missions.value[0] : []));

// Fetch topics
const { data: allTopics } = useQuery<string[]>({
    queryKey: ['topics'],
    queryFn: allTopicsNames,
});
const displayedTopics = ref(allTopics.value);
const selectedTopics = ref([]);

const and_or = ref(false);
const tagFilter = ref({});

end.setHours(23, 59, 59, 999);
const dateTime: Ref<{ from: string; to: string }> = ref({
    from: formatDate(start),
    to: formatDate(end),
});

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
        rowsNumber: handler.value?.rowsNumber,
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
    handler.value.project_uuid,
    handler.value.mission_uuid,
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
    Object.keys(tagFilter.value).forEach((key) => {
        query[key] = tagFilter.value[key].value;
    });
    return query;
});

const selectedFileTypes = computed(() => {
    return fileTypeFilter.value
        .filter((item) => item.value)
        .map((item) => item.name)
        .join(' & ');
});

const { data: _data, isLoading } = useQuery<[FileEntity[], number]>({
    queryKey: queryKeyFiles,
    queryFn: () =>
        fetchOverview(
            filter.value,
            handler.value.project_uuid,
            handler.value.mission_uuid,
            startDate.value,
            endDate.value,
            selectedTopics.value || [],
            and_or.value,
            selectedFileTypesFilter.value,
            tagFilterQuery.value,
            handler.value.take,
            handler.value.skip,
            handler.value.sortBy,
            handler.value.descending,
        ),
});
const data = computed(() => (_data.value ? _data.value[0] : []));
const total = computed(() => (_data.value ? _data.value[1] : 0));

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
        name: 'project.name',
        required: true,
        label: 'Project',
        align: 'left',
        field: (row: FileEntity) => row.mission?.project?.name,
        format: (val: string) => `${val}`,
        sortable: false,
        style: 'width:  10%; max-width:  10%; min-width: 10%;',
    },
    {
        name: 'mission.name',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: FileEntity) => row.mission?.name,
        format: (val: string) => `${val}`,
        sortable: false,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'file.filename',
        required: true,
        label: 'File',
        align: 'left',
        field: (row: FileEntity) => row.filename,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  15%; max-width:  15%; min-width: 15%;',
    },
    {
        name: 'file.date',
        required: true,
        label: 'Recoring Date',
        align: 'left',
        field: (row: FileEntity) => row.date,
        format: (val: string) => formatDate(new Date(val)),
        sortable: true,
    },
    {
        name: 'file.createdAt',
        required: true,
        label: 'Creation Date',
        align: 'left',
        field: (row: FileEntity) => row.createdAt,
        format: (val: string) => formatDate(new Date(val)),
        sortable: true,
    },
    {
        name: 'Creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: FileEntity) => row.creator.name,
        format: (val: string) => `${val}`,
        sortable: false,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'file.size',
        required: true,
        label: 'Size',
        align: 'left',
        field: (row: FileEntity) => row.size,
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
 * open a q-dialog with a file editor
 */
function openQDialog(file: FileEntity): void {
    $q.dialog({
        title: 'Profilbild wählen',
        component: EditMission,
        componentProps: {
            file_uuid: file.uuid,
        },
    });
}

function openTagFilterDialog() {
    $q.dialog({
        title: 'Filter by Tags',
        component: TagFilter,
        componentProps: {
            tagValues: tagFilter.value,
        },
    }).onOk((_tagFilter) => {
        tagFilter.value = _tagFilter;
    });
}

function filterFn(val: string, update) {
    if (val === '') {
        update(() => {
            displayedTopics.value = allTopics.value;
        });
        return;
    }
    update(() => {
        if (!allTopics.value) return;
        const needle = val.toLowerCase();
        const filtered = allTopics.value.filter(
            (v) => v.toLowerCase().indexOf(needle) > -1,
        );
        console.log(filtered);
        displayedTopics.value = filtered;
    });
}

const onRowClick = (_: Event, row: any) => {
    $routerService?.routeTo(ROUTES.FILE, {
        uuid: row.uuid,
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
    tagFilter.value = [];
    resetStartDate();
    resetEndDate();
}
</script>
<style scoped></style>
