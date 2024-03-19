<template>
  <q-card class="q-pa-md" flat bordered>
    <div class="row">
      <div class="col-1 col-lg-2">
        <q-btn-dropdown
          v-model="dd_open"
          :label="selected_project?.name || 'Filter by Project'"
          outlined
          dense
          clearable
          required
        >
          <q-list>
            <q-item
              v-for="project in projects"
              :key="project.uuid"
              clickable
              @click="selected_project = project; dd_open=false"
            >
              <q-item-section>
                <q-item-label>
                  {{ project.name }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>
      <div class="col-3 col-lg-2">
        <q-input
          v-model="filter"
          outlined
          dense
          clearable
          placeholder="Filter by Run Name"
        />
      </div>
      <div class="col-3">
        <q-input filled v-model="dateTimeString">
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

          <template v-slot:append>
            <q-icon name="access_time" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-time v-model="dateTime" :mask="dateMask" format24h>
                  <div class="row items-center justify-end">
                    <q-btn v-close-popup label="Close" color="primary" flat />
                  </div>
                </q-time>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
      </div>
      <div class="col-1 col-lg-2">
        <q-select
          v-model="selectedTopics"
          label="Select Topics"
          outlined
          dense
          clearable
          multiple
          use-chips
          option-value="uuid"
          option-label="name"
          :options="topics"
          emit-value
          map-options
          required
        />
      </div>
      <div class="col-1 col-lg-2">
        <q-toggle v-model="and_or" :label="and_or ? 'And' : 'Or'"/>
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
      :filter="filter"
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
        </q-td>
      </template>
    </QTable>
  </q-card>
</template>
<script setup lang="ts">
import { computed, Ref, ref } from 'vue';
import { QTable, useQuasar } from 'quasar';
import { useQuery } from '@tanstack/vue-query'
import { allProjects, allTopics, fetchOverview } from 'src/services/queries';
import { format } from 'date-fns';
import { Project, Run, Topic } from 'src/types/types';
import EditRun from 'components/EditRun.vue';
import { dateMask, formatDate } from 'src/services/dateFormating';

const $q = useQuasar();


const tableRef: Ref<QTable | null> = ref(null);
const loading = ref(false);
const filter = ref('');
const { isLoading, isError, data, error } = useQuery({ queryKey: ['runs'], queryFn: fetchOverview });

const dd_open = ref(false);
const selected_project: Ref<Project | null> = ref(null);
const projectsReturn = useQuery<Project[]>({ queryKey: ['projects'], queryFn: allProjects });
const projects = projectsReturn.data

const topicsReturn = useQuery<Topic[]>({ queryKey: ['topics'], queryFn: allTopics });
const topics = topicsReturn.data
const selectedTopics = ref([]);
const and_or = ref(false)


const start = new Date();
start.setHours(0, 0, 0, 0);
start.setMonth(start.getMonth() - 1);

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

const selected = ref([]);
const pagination = ref({ sortBy: 'name', descending: false, page: 1, rowsPerPage: 10 });
const columns = [
  {
    name: 'Project',
    required: true,
    label: 'Project',
    align: 'left',
    field: (row: Run) => row.project.name,
    format: (val:string) => `${val}`,
    sortable: true
  },
  {
    name: 'Run',
    required: true,
    label: 'Run Name',
    align: 'left',
    field: (row: Run)  => row.name,
    format: (val:string) => `${val}`,
    sortable: true
  },
  {
    name: 'Date',
    required: true,
    label: 'Date',
    align: 'left',
    field: (row: Run)  => row.date,
    format: (val:string) => format(new Date(val), 'MMMM dd, yyyy'),
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
 * open a q-dialog with a run editor
 */
function openQDialog(run: Run): void {
  $q.dialog({
    title: 'Profilbild wählen',
    component: EditRun,
    componentProps: {
      run_uuid: run.uuid
    },
  });
}
</script>
<style scoped>
</style>
