<template>
  <q-card class="q-pa-md" flat bordered>
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
            @click="()=>view_project(props.row)"
          ></q-btn>
        </q-td>
      </template>
      <template v-slot:body-cell-runaction="props">
        <q-td :props="props">
          <q-btn
            color="primary"
            label="View"
            @click="()=>view_run(props.row)"
          ></q-btn>
        </q-td>
      </template>
      <template v-slot:body-cell-fileaction="props">
        <q-td :props="props">
          <q-btn
            color="primary"
            label="View"
            @click="()=>view_file(props.row)"
          ></q-btn>
        </q-td>
      </template>
    </QTable>
  </q-card>
</template>
<script setup lang="ts">
import {useQuery} from '@tanstack/vue-query';
import {FileEntity, Project, Run} from 'src/types/types';
import {allProjects, filesOfRun, runsOfProject} from 'src/services/queries';
import {QTable} from 'quasar';
import {computed, inject, Ref, ref} from 'vue';
import {formatDate} from 'src/services/dateFormating';
import {formatSize} from 'src/services/generalFormatting';
import RouterService from 'src/services/routerService';
import ROUTES from 'src/router/routes';
const $routerService: RouterService | undefined = inject('$routerService');


type crumb = { name: string, uuid: string, type: string };
const crumbs: Ref<crumb[]> = ref([{name: 'All', uuid: '', type: 'Projects' }]);
const column_index = ref(0)

const projectsReturn = useQuery<Project[]>(
  { queryKey: ['projects'],
    queryFn: allProjects
  }
);

const runsReturn = useQuery(
  { queryKey: ['runs', crumbs.value[crumbs.value.length - 1].uuid] ,
    queryFn: () => runsOfProject(crumbs.value[crumbs.value.length - 1].uuid),
    enabled: crumbs.value[crumbs.value.length - 1].type === 'Runs',
  }
);

const filesReturn = useQuery(
  { queryKey: ['files', crumbs.value[crumbs.value.length - 1].uuid] ,
    queryFn: () => filesOfRun(crumbs.value[crumbs.value.length - 1].uuid),
    enabled: crumbs.value[crumbs.value.length - 1].type === 'Files',
  }
);

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
const pagination = ref({ sortBy: 'name', descending: false, page: 1, rowsPerPage: 10 });
const project_columns = [
  {
    name: 'Project',
    required: true,
    label: 'Project',
    align: 'left',
    field: (row: Project) => row.name,
    format: (val:string) => `${val}`,
    sortable: true
  },
  {
    name: 'Description',
    required: true,
    label: 'Description',
    align: 'left',
    field: (row: Project) => row.description || '',
    format: (val:string) => `${val}`,
    sortable: true
  },
  {
    name: 'Creator',
    required: true,
    label: 'Creator',
    align: 'left',
    field: (row: Project) => row.creator ? row.creator.name: '',
    format: (val:number) => `${val}`,
    sortable: true
  },
  {
    name: 'Created',
    required: true,
    label: 'Created',
    align: 'left',
    field: (row: Project) => row.createdAt,
    format: (val:string) => formatDate(new Date(val)),
    sortable: true
  },
  {
    name: 'NrOfRuns',
    required: true,
    label: 'Nr of Runs',
    align: 'left',
    field: (row: Project) => row.runs.length,
    format: (val:number) => `${val}`,
    sortable: true
  },
  {
    name: 'projectaction',
    label: 'Action',
    align: 'center',
  }
];
const run_columns = [
  {
    name: 'Run',
    required: true,
    label: 'Run',
    align: 'left',
    field: (row: Run) => row.name,
    format: (val:string) => `${val}`,
    sortable: true
  },
  {
    name: 'Created',
    required: true,
    label: 'Created',
    align: 'left',
    field: (row: Run) => row.createdAt,
    format: (val:string) => formatDate(new Date(val)),
  },
  {
    name: 'NrOfFiles',
    required: true,
    label: 'Nr of Files',
    align: 'left',
    field: (row: Run) => row.files.length,
    format: (val:number) => `${val}`,
    sortable: true
  },
  {
    name: 'runaction',
    label: 'Action',
    align: 'center',
  }
]

const file_columns = [
  {
    name: 'File',
    required: true,
    label: 'File',
    align: 'left',
    field: (row: FileEntity) => row.filename,
    format: (val:string) => `${val}`,
    sortable: true
  },
  {
    name: 'Created',
    required: true,
    label: 'Created',
    align: 'left',
    field: (row: FileEntity) => row.date,
    format: (val:string) => formatDate(new Date(val)),
  },
  {
    name: 'Size',
    required: true,
    label: 'Size',
    align: 'left',
    field: (row: FileEntity) => row.size,
    format: formatSize,
    sortable: true
  },
  {
    name: 'fileaction',
    required: true,
    label: 'Action',
    align: 'center',
  }
]
const columns = [project_columns, run_columns, file_columns]
function view_project(project: Project) {
  crumbs.value.push({ name: project.name, uuid: project.uuid, type: 'Runs' });
  runsReturn.refetch();
  column_index.value = 1;
}

function view_run(run: Run) {
  crumbs.value.push({ name: run.name, uuid: run.uuid, type: 'Files' });
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
</script>

<style scoped>

</style>
