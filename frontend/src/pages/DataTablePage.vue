<template>
    <q-card class="q-pa-md q-mt-xl q-mb-md" flat bordered>
        <q-card-section>
            <div class="row q-gutter-sm">
                <div class="col-12 col-md-2">
                    <q-btn-dropdown
                        v-model="dd_open_projects"
                        :label="selected_project?.name || 'Filter by Project'"
                        outline
                        dense
                        clearable
                        class="full-width"
                        style="height: 100%"
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
                                    <q-item-label
                                        >{{ project.name }}
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-btn-dropdown>
                </div>
                <div class="col-12 col-md-2">
                    <q-btn-dropdown
                        v-model="dd_open_missions"
                        :label="selected_mission?.name || 'Filter by Mission'"
                        outline
                        dense
                        clearable
                        class="full-width"
                        style="height: 100%"
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
                                    <q-item-label
                                        >{{ mission.name }}
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-btn-dropdown>
                </div>

                <div class="col-12 col-md-1">
                    <q-input
                        v-model="filter"
                        outlined
                        dense
                        debounce="300"
                        clearable
                        placeholder="Filter by File Name"
                        class="full-width"
                    />
                </div>

                <div class="col-12 col-md-3">
                    <q-input
                        filled
                        v-model="dateTimeString"
                        dense
                        outlined
                        clearable
                        class="full-width"
                        placeholder="Select Date Range"
                    >
                        <template v-slot:prepend>
                            <q-icon name="sym_o_event" class="cursor-pointer">
                                <q-popup-proxy
                                    cover
                                    transition-show="scale"
                                    transition-hide="scale"
                                >
                                    <q-date
                                        v-model="dateTime"
                                        :mask="dateMask"
                                        range
                                    >
                                        <div
                                            class="row items-center justify-end"
                                        >
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

                <div class="col-12 col-md-3">
                    <div class="row">
                        <div class="col-8">
                            <q-select
                                v-model="selectedTopics"
                                label="Select Topics"
                                outlined
                                dense
                                clearable
                                multiple
                                use-chips
                                :options="topics"
                                emit-value
                                map-options
                                class="full-width"
                            />
                        </div>
                        <div class="col-2 flex justify-right">
                            <q-toggle
                                style="padding-left: 5px"
                                v-model="and_or"
                                :label="and_or ? 'And' : 'Or'"
                                dense
                            >
                                <q-tooltip>
                                    Toggle between AND/OR conditions for the
                                    topics.
                                    <br />And: Mission contains all selected
                                    topics, Or: Mission contains any of the
                                    selected topics
                                </q-tooltip>
                            </q-toggle>

                            <q-toggle
                                style="padding-left: 5px"
                                v-model="mcap_bag"
                                :label="mcap_bag ? 'MCAP' : 'Bag'"
                                dense
                            >
                                <q-tooltip>
                                    Display only Bag / MCAP Files.
                                </q-tooltip>
                            </q-toggle>
                        </div>
                        <div class="col-2">
                            <q-btn
                                outline
                                text-color="black"
                                label="Tag "
                                color="primary"
                                icon="sym_o_filter_list"
                                @click="openTagFilterDialog"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </q-card-section>
        <q-card-section>
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
                binary-state-sort
                selection="multiple"
                @row-click="onRowClick"
                @request="setPagination"
            >
                <template v-slot:body-cell-action="props">
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
                                    <q-item
                                        clickable
                                        v-ripple
                                        @click="() => openQDialog(props.row)"
                                    >
                                        <q-item-section
                                            >Edit File
                                        </q-item-section>
                                    </q-item>
                                    <q-item
                                        clickable
                                        v-ripple
                                        @click="
                                            () =>
                                                $routerService?.routeTo(
                                                    ROUTES.FILE,
                                                    { uuid: props.row.uuid },
                                                )
                                        "
                                    >
                                        <q-item-section
                                            >View File
                                        </q-item-section>
                                    </q-item>
                                    <q-item clickable v-ripple disable>
                                        <q-item-section
                                            >Delete File
                                        </q-item-section>
                                    </q-item>
                                </q-list>
                            </q-menu>
                        </q-btn>
                    </q-td>
                </template>
            </q-table>
        </q-card-section>
    </q-card>
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
import { useRouter } from 'vue-router';
import { QueryURLHandler } from 'src/services/URLHandler';
import TagFilter from 'src/dialogs/TagFilter.vue';

const $routerService: RouterService | undefined = inject('$routerService');

const $q = useQuasar();
const router = useRouter();

const tableRef: Ref<QTable | null> = ref(null);

const handler: Ref<QueryURLHandler> = ref(
    new QueryURLHandler(),
) as unknown as Ref<QueryURLHandler>;
handler.value.setRouter(router);

const loading = ref(false);
const filter = ref('');

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
const topicsReturn = useQuery<string[]>({
    queryKey: ['topics'],
    queryFn: allTopicsNames,
});
const topics = topicsReturn.data;
const selectedTopics = ref([]);

const and_or = ref(false);
const mcap_bag = ref(true);
const tagFilter = ref({});

const start = new Date(0);
const end = new Date();
end.setHours(23, 59, 59, 999);
const dateTime: Ref<{ from: string; to: string }> = ref({
    from: formatDate(start),
    to: formatDate(end),
});
const dateTimeString = computed({
    get: () => `${dateTime.value.from} - ${dateTime.value.to}`,
    set: (val: string) => {
        const [from, to] = val.split(' - ');
        dateTime.value = { from, to };
    },
});
const startDate = computed(() => parseDate(dateTime.value.from));
const endDate = computed(() => parseDate(dateTime.value.to));

const pagination = computed(() => {
    return {
        page: handler.value.page,
        rowsPerPage: handler.value.take,
        rowsNumber: handler.value?.rowsNumber,
        sortBy: 'name',
        descending: false,
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
    handler.value.setTake(update.pagination.rowsPerPage);
    handler.value.setPage(update.pagination.page);
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
    mcap_bag,
    handler.value.queryKey,
]);

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
            mcap_bag.value,
            tagFilter.value,
            handler.value.take,
            handler.value.skip,
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
);

const columns = [
    {
        name: 'Project',
        required: true,
        label: 'Project',
        align: 'left',
        field: (row: FileEntity) => row.mission?.project?.name,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  10%; max-width:  10%; min-width: 10%;',
    },
    {
        name: 'Mission',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: FileEntity) => row.mission?.name,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'File',
        required: true,
        label: 'File',
        align: 'left',
        field: (row: FileEntity) => row.filename,
        format: (val: string) => `${val}`,
        sortable: true,
        style: 'width:  15%; max-width:  15%; min-width: 15%;',
    },
    {
        name: 'Date',
        required: true,
        label: 'Recoring Date',
        align: 'left',
        field: (row: FileEntity) => row.date,
        format: (val: string) => formatDate(new Date(val)),
        sortable: true,
    },
    {
        name: 'Creation Date',
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
        sortable: true,
        style: 'width:  9%; max-width:  9%; min-width: 9%;',
    },
    {
        name: 'Size',
        required: true,
        label: 'Size',
        align: 'left',
        field: (row: FileEntity) => row.size,
        format: formatSize,
        sortable: true,
        sort: (_a: string, _b: string, a: FileEntity, b: FileEntity) =>
            a.size - b.size,
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

const onRowClick = (_: Event, row: any) => {
    $routerService?.routeTo(ROUTES.FILE, {
        uuid: row.uuid,
    });
};
</script>
