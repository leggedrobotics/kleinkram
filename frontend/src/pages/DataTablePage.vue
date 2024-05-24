<template>
  <q-card class="q-pa-md" flat bordered>
    <div class="row q-gutter-sm">
      <div class="col-12 col-md-2">
        <q-btn-dropdown
          v-model="dd_open"
          :label="selected_project?.name || 'Filter by Project'"
          outlined
          dense
          clearable
          class="full-width"
        >
          <q-list>
            <q-item
              v-for="project in projects"
              :key="project.uuid"
              clickable
              @click="selected_project = project; dd_open=false"
            >
              <q-item-section>
                <q-item-label>{{ project.name }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>
      <div class="col-12 col-md-2">
        <q-btn-dropdown
          v-model="dd_open_runs"
          :label="selected_run?.name || 'Filter by Run'"
          outlined
          dense
          clearable
          class="full-width"
        >
          <q-list>
            <q-item
              v-for="run in runs"
              :key="run.uuid"
              clickable
              @click="selected_run = run; dd_open_runs=false"
            >
              <q-item-section>
                <q-item-label>{{ run.name }}</q-item-label>
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
          clearable
          placeholder="Filter by Run Name"
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
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="dateTime" :mask="dateMask" range>
                  <div class="row items-center justify-end">
                    <q-btn v-close-popup label="Close" color="primary" flat />
                  </div>
                </q-date>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
      </div>

      <div class="col-12 col-md-3">
        <div class="row ">
          <div class="col-10">
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
          <div class="col-2 flex justify-center">
            <q-toggle style="padding-left: 5px" v-model="and_or" :label="and_or ? 'And' : 'Or'" dense />
            <q-tooltip >Toggle between AND/OR conditions for the topics. <br>And: Run contains all selected topics, Or: Run contains any of the selected topics</q-tooltip>
          </div>
        </div>
      </div>


    </div>


    <q-separator class="q-ma-md"/>
    <QTable
      ref="tableRef"
      v-model:pagination="pagination"
      v-model:selected="selected"
      title="Datasets"
      :rows="data"
      :columns="columns"
      row-key="uuid"
      :loading="loading"
      binary-state-sort
      selection= 'multiple'
    >
      <template v-slot:body-cell-action="props">
        <q-td :props="props">
          <q-btn
            color="primary"
            label="Edit"
            @click="()=>openQDialog(props.row)"
          ></q-btn>
          <q-btn
            color="primary"
            label="View"
            @click="()=>$routerService?.routeTo(ROUTES.FILE, { uuid: props.row.uuid })"
          ></q-btn>
        </q-td>
      </template>
    </QTable>
  </q-card>
</template>
<script setup lang="ts">
import { computed, inject, Ref, ref, watch, watchEffect } from 'vue';
import { debounce, QTable, useQuasar } from 'quasar';
import { useQuery } from '@tanstack/vue-query'
import { allProjects, allTopicsNames, fetchOverview, runsOfProject } from 'src/services/queries';
import { FileEntity, Project, Run } from 'src/types/types';
import EditRun from 'components/EditFile.vue';
import { dateMask, formatDate, parseDate } from 'src/services/dateFormating';
import ROUTES from 'src/router/routes';
import RouterService from 'src/services/routerService';
import {formatSize} from 'src/services/generalFormatting';
const $routerService: RouterService | undefined = inject('$routerService');

const $q = useQuasar();


const tableRef: Ref<QTable | null> = ref(null);
const loading = ref(false);
const filter = ref('');
const updateFilter = debounce((newFilter) => {
  debouncedFilter.value = newFilter;
}, 500); // Delay of 500ms
watch(filter, ()=> updateFilter(filter.value))
const debouncedFilter = ref('');
const selected_project: Ref<Project | null> = ref(null);

const dd_open = ref(false);
const projectsReturn = useQuery<Project[]>({ queryKey: ['projects'], queryFn: allProjects });
const projects = projectsReturn.data

const dd_open_runs = ref(false);
const selected_run: Ref<Run | null> = ref(null);

const { data: runs, refetch } = useQuery(
  { queryKey: ['runs', selected_project.value?.uuid],
    queryFn: () => runsOfProject(selected_project.value?.uuid || ''),
    enabled: !!selected_project.value?.uuid,
  }
);

watchEffect(() => {
  if (selected_project.value?.uuid) {
    refetch();
  }
});



const topicsReturn = useQuery<string[]>({ queryKey: ['topics'], queryFn: allTopicsNames });
const topics = topicsReturn.data
const selectedTopics = ref([]);
const and_or = ref(false)


const start = new Date();
start.setHours(0, 0, 0, 0);
start.setMonth(start.getMonth() - 12);

const end = new Date();
end.setHours(23, 59, 59, 999);
const dateTime: Ref<{from: string, to: string}> = ref({ from: formatDate(start), to: formatDate(end)});
const dateTimeString = computed({
  get: () => `${dateTime.value.from} - ${dateTime.value.to}`,
  set: (val: string) => {
    const [from, to] = val.split(' - ');
    dateTime.value = { from, to };
  }
});
const startDate = computed(()=> parseDate(dateTime.value.from));
const endDate = computed(()=> parseDate(dateTime.value.to));

const selected = ref([]);
const pagination = ref({ sortBy: 'name', descending: false, page: 1, rowsPerPage: 10 });

const { isLoading, isError, data, error } = useQuery({ queryKey: [
  'Filtered Files',
    debouncedFilter,
    selected_project,
    selected_run,
    startDate,
    endDate,
    selectedTopics,
    and_or
  ]
  , queryFn: ()=> fetchOverview(debouncedFilter.value, selected_project.value?.uuid,selected_run.value?.uuid, startDate.value, endDate.value, selectedTopics.value || [], and_or.value) });


const columns = [
  {
    name: 'Project',
    required: true,
    label: 'Project',
    align: 'left',
    field: (row: FileEntity) => row.run?.project?.name,
    format: (val:string) => `${val}`,
    sortable: true
  },
  {
    name: 'Run',
    required: true,
    label: 'Run',
    align: 'left',
    field: (row: FileEntity) => row.run.name,
    format: (val:string) => `${val}`,
    sortable: true
  },
  {
    name: 'File',
    required: true,
    label: 'File',
    align: 'left',
    field: (row: FileEntity)  => row.filename,
    format: (val:string) => `${val}`,
    sortable: true
  },
  {
    name: 'Date',
    required: true,
    label: 'Recoring Date',
    align: 'left',
    field: (row: FileEntity)  => row.date,
    format: (val:string) => formatDate(new Date(val)),
    sortable: true
  },
  {
    name: 'Creation Date',
    required: true,
    label: 'Creation Date',
    align: 'left',
    field: (row: FileEntity)  => row.createdAt,
    format: (val:string) => formatDate(new Date(val)),
    sortable: true
  },
  {
    name: 'Creator',
    required: true,
    label: 'Creator',
    align: 'left',
    field: (row: FileEntity)  => row.creator,
    format: (val:string) => `${val}`,
    sortable: true
  },
  {
    name: 'Size',
    required: true,
    label: 'Size',
    align: 'left',
    field: (row: FileEntity)  => row.size,
    format: formatSize,
    sortable: true
  },
  {
    name: 'action',
    required: true,
    label: 'Edit',
    align: 'center',
    field: 'Edit'
  }
]
/**
 * open a q-dialog with a file editor
 */
function openQDialog(file: FileEntity): void {
  $q.dialog({
    title: 'Profilbild wählen',
    component: EditRun,
    componentProps: {
      file_uuid: file.uuid
    },
  });
}
</script>
<style scoped>
</style>
