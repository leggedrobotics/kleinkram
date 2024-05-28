<template>
    <q-card class="q-pa-md" flat bordered>
        <div class="row">
            <div class="col-9">
                <q-breadcrumbs>
                    <q-breadcrumbs-el
                        v-for="crumb in crumbs"
                        :key="crumb.uuid"
                        :label="crumb.name"
                        clickable
                        @click="navigate(crumb)"
                    >
                    </q-breadcrumbs-el>
                </q-breadcrumbs>
            </div>
            <div class="col-2">
                <q-btn
                    color="primary"
                    @click="create"
                    :label="'Create ' + crumbs[crumbs.length - 1].type"
                />
            </div>
            <div class="col-1">
                <q-btn color="primary" @click="refresh" icon="refresh" />
            </div>
        </div>
        <EditProject
            v-if="column_index === 1"
            :project_uuid="crumbs[crumbs.length - 1].uuid"
            @project-deleted="projectDeleted"
        />
        <QTable
            ref="tableRef"
            v-model:pagination="pagination"
            v-model:selected="selected"
            :title="crumbs[crumbs.length - 1].type"
            :rows="currentData"
            :columns="columns[column_index]"
            row-key="uuid"
            :loading="loading"
            binary-state-sort
        >
            <template v-slot:body-cell-projectaction="props">
                <q-td :props="props">
                    <q-btn
                        color="primary"
                        label="View"
                        @click="() => view_project(props.row)"
                    ></q-btn>
                </q-td>
            </template>
            <template v-slot:body-cell-runaction="props">
                <q-td :props="props">
                    <q-btn
                        color="primary"
                        label="Move"
                        style="margin-right: 5px"
                        @click="() => move(props.row)"
                    />
                    <q-btn
                        color="primary"
                        label="View"
                        @click="() => view_run(props.row)"
                    />
                </q-td>
            </template>
            <template v-slot:body-cell-fileaction="props">
                <q-td :props="props">
                    <q-btn
                        color="primary"
                        label="View"
                        @click="() => view_file(props.row)"
                    ></q-btn>
                </q-td>
            </template>
        </QTable>
    </q-card>
</template>
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { FileEntity, Project, Run } from 'src/types/types';
import { allProjects, filesOfRun, runsOfProject } from 'src/services/queries';
import { QTable, useQuasar } from 'quasar';
import { computed, inject, Ref, ref } from 'vue';
import { formatDate } from 'src/services/dateFormating';
import { formatSize } from 'src/services/generalFormatting';
import RouterService from 'src/services/routerService';
import ROUTES from 'src/router/routes';
import CreateProjectDialog from 'components/CreateProjectDialog.vue';
import CreateRunDialog from 'components/CreateRunDialog.vue';
import CreateFileDialog from 'components/CreateFileDialog.vue';
import EditProject from 'components/EditProject.vue';
import MoveRun from 'components/MoveRun.vue';
const $routerService: RouterService | undefined = inject('$routerService');

type crumb = {
    name: string;
    entity: Project | Run | FileEntity | undefined;
    type: string;
    uuid: string;
};
const crumbs: Ref<crumb[]> = ref([
    { name: 'All', entity: undefined, type: 'Projects', uuid: '' },
]);
const column_index = ref(0);
const runsQueryKey = computed(() => [
    'runs',
    crumbs.value[crumbs.value.length - 1].uuid,
]);
const filesQueryKey = computed(() => [
    'files',
    crumbs.value[crumbs.value.length - 1].uuid,
]);
const runsQueryEnabled = computed(
    () => crumbs.value[crumbs.value.length - 1].type === 'Runs',
);
const filesQueryEnabled = computed(
    () => crumbs.value[crumbs.value.length - 1].type === 'Files',
);
const $q = useQuasar();

const projectsReturn = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: allProjects,
});

const runsReturn = useQuery({
    queryKey: runsQueryKey,
    queryFn: () => runsOfProject(crumbs.value[crumbs.value.length - 1].uuid),
    enabled: runsQueryEnabled,
});

const filesReturn = useQuery({
    queryKey: filesQueryKey,
    queryFn: () => filesOfRun(crumbs.value[crumbs.value.length - 1].uuid),
    enabled: filesQueryEnabled,
});

function projectDeleted() {
    column_index.value = 0;
    crumbs.value = [
        { name: 'All', entity: undefined, type: 'Projects', uuid: '' },
    ];
}

const currentData = computed(() => {
    if (column_index.value === 0) {
        return projectsReturn.data?.value || [];
    } else if (column_index.value === 1) {
        return runsReturn.data?.value || [];
    } else if (column_index.value === 2) {
        return filesReturn.data?.value || [];
    }
    return [];
});
const loading = projectsReturn.isLoading;
const selected = ref([]);
const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 10,
});
const project_columns = [
    {
        name: 'Project',
        required: true,
        label: 'Project',
        align: 'left',
        field: (row: Project) => row.name,
        format: (val: string) => `${val}`,
        sortable: true,
    },
    {
        name: 'Description',
        required: true,
        label: 'Description',
        align: 'left',
        field: (row: Project) => row.description || '',
        format: (val: string) => `${val}`,
        sortable: true,
    },
    {
        name: 'Creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: Project) => (row.creator ? row.creator.name : ''),
        format: (val: number) => `${val}`,
        sortable: true,
    },
    {
        name: 'Created',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: Project) => row.createdAt,
        format: (val: string) => formatDate(new Date(val)),
        sortable: true,
    },
    {
        name: 'NrOfRuns',
        required: true,
        label: 'Nr of Runs',
        align: 'left',
        field: (row: Project) => row.runs.length,
        format: (val: number) => `${val}`,
        sortable: true,
    },
    {
        name: 'projectaction',
        label: 'Action',
        align: 'center',
    },
];
const run_columns = [
    {
        name: 'Run',
        required: true,
        label: 'Run',
        align: 'left',
        field: (row: Run) => row.name,
        format: (val: string) => `${val}`,
        sortable: true,
    },
    {
        name: 'Created',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: Run) => row.createdAt,
        format: (val: string) => formatDate(new Date(val)),
    },
    {
        name: 'NrOfFiles',
        required: true,
        label: 'Nr of Files',
        align: 'left',
        field: (row: Run) => row.files.length,
        format: (val: number) => `${val}`,
        sortable: true,
    },
    {
        name: 'runaction',
        label: 'Action',
        align: 'center',
    },
];

const file_columns = [
    {
        name: 'File',
        required: true,
        label: 'File',
        align: 'left',
        field: (row: FileEntity) => row.filename,
        format: (val: string) => `${val}`,
        sortable: true,
    },
    {
        name: 'Created',
        required: true,
        label: 'Created',
        align: 'left',
        field: (row: FileEntity) => row.date,
        format: (val: string) => formatDate(new Date(val)),
    },
    {
        name: 'Size',
        required: true,
        label: 'Size',
        align: 'left',
        field: (row: FileEntity) => row.size,
        format: formatSize,
        sortable: true,
    },
    {
        name: 'fileaction',
        required: true,
        label: 'Action',
        align: 'center',
    },
];
const columns = [project_columns, run_columns, file_columns];
function view_project(project: Project) {
    crumbs.value.push({
        name: project.name,
        entity: project,
        type: 'Runs',
        uuid: project.uuid,
    });
    runsReturn.refetch();
    column_index.value = 1;
}

function view_run(run: Run) {
    crumbs.value.push({
        name: run.name,
        uuid: run.uuid,
        type: 'Files',
        entity: run,
    });
    filesReturn.refetch();
    column_index.value = 2;
}

function view_file(file: FileEntity) {
    $routerService?.routeTo(ROUTES.FILE, { file_uuid: file.uuid });
}

function navigate(crumb: crumb) {
    const index = crumbs.value.findIndex((c) => c.uuid === crumb.uuid);
    crumbs.value = crumbs.value.slice(0, index + 1);
    column_index.value = index;
    console.log('navigate', crumb);
}

function create() {
    if (column_index.value === 0) {
        $q.dialog({
            title: 'Create new project',
            component: CreateProjectDialog,
            persistent: false,
            style: 'max-width: 1500px',
        });
    } else if (column_index.value === 1) {
        $q.dialog({
            title: 'Create new run',
            component: CreateRunDialog,
            persistent: false,
            style: 'max-width: 1500px',
            componentProps: {
                project: crumbs.value[crumbs.value.length - 1].entity,
            },
        });
    } else if (column_index.value === 2) {
        $q.dialog({
            title: 'Create new file',
            component: CreateFileDialog,
            persistent: false,
            style: 'max-width: 1500px',
            componentProps: {
                run: crumbs.value[crumbs.value.length - 1].entity,
            },
        });
    }
}

function refresh() {
    if (column_index.value === 0) {
        projectsReturn.refetch();
    } else if (column_index.value === 1) {
        runsReturn.refetch();
    } else if (column_index.value === 2) {
        filesReturn.refetch();
    }
}

function move(run: Run) {
    $q.dialog({
        title: 'Move run',
        component: MoveRun,
        persistent: false,
        style: 'max-width: 1500px',
        componentProps: { run: run },
    });
}
</script>

<style scoped></style>
