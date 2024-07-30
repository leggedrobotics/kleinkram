<template>


  <q-table
      flat bordered
      ref="tableRef"
      v-model:pagination="pagination"
      v-model:selected="selected"
      :rows="data"
      :columns="getColumns(currentDataType) as any"
      row-key="uuid"
      :loading="isLoading"
      binary-state-sort
      wrap-cells
      virtual-scroll
      separator="none"
      selection="multiple"
      @row-click="onRowClick"
      @request="loadData"
  >

    <template v-slot:loading>
      <q-inner-loading showing color="primary"/>
    </template>

    <template v-slot:body-cell-projectaction="props">
      <q-td :props="props">
        <q-btn
            color="primary"
            label="View"
            outline
        ></q-btn>
      </q-td>
    </template>
    <template v-slot:body-cell-missionaction="props">
      <q-td :props="props">
        <q-btn
            color="primary"
            label="Move"
            style="margin-right: 5px"
            outline
        />
        <q-btn
            color="primary"
            label="View"
            outline
        />
      </q-td>
    </template>
    <template v-slot:body-cell-fileaction="props">
      <q-td :props="props">
        <q-btn
            color="primary"
            label="View"
            outline
        ></q-btn>
      </q-td>
    </template>
  </q-table>

</template>


<script setup lang="ts">

import {QTable} from "quasar";
import {inject, ref, watch} from "vue";
import {allProjects} from "src/services/queries/project";
import {missionsOfProject} from "src/services/queries/mission";
import RouterService from "src/services/routerService";
import {filesOfMission} from "src/services/queries/file";
import ROUTES from "src/router/routes";
import {useRoute} from "vue-router";
import {DataType, getColumns} from "components/explorer_page/project_columns";

const $routerService: RouterService | undefined = inject('$routerService');
const route = useRoute()
const isLoading = ref(true);

const selected = ref([])

const DEFAULT_SORT = {sortBy: 'name', descending: false}
const DEFAULT_PAGINATION = {page: 1, rowsPerPage: 10, rowsNumber: 0}

const pagination = ref({
  sortBy: DEFAULT_SORT.sortBy,
  descending: DEFAULT_SORT.descending,
  page: DEFAULT_PAGINATION.page,
  rowsPerPage: DEFAULT_PAGINATION.rowsPerPage,
  rowsNumber: DEFAULT_PAGINATION.rowsNumber
})

// watch on route change
watch(() => route.query, async (query) => {
  await loadData()
})

const currentDataType = ref<DataType>(!!route.query.project_uuid ? DataType.MISSIONS : DataType.PROJECTS);
const data = ref<any>([]);

// load data based on current URL params and search
const loadData = async (props?: any) => {
  isLoading.value = true;

  //////////////////////////
  // Extract Data Fetching Parameters
  //////////////////////////

  const project_uuid = route.query.project_uuid as string;
  const mission_uuid = route.query.mission_uuid as string;

  const page = props?.pagination?.page || route.query.page || DEFAULT_PAGINATION.page;
  const take = props?.pagination?.rowsPerPage || route.query.rowsPerPage || DEFAULT_PAGINATION.rowsPerPage;
  const sortBy = props?.pagination?.sortBy || route.query.sortBy || DEFAULT_SORT.sortBy;
  const descending = (props?.pagination?.descending !== undefined) ? props?.pagination?.descending : (route.query.descending === 'true') || DEFAULT_SORT.descending;
  const skip = (page - 1) * take

  const searchParams = {name: route.query.search as string};

  //////////////////////////
  // update URL params
  //////////////////////////

  if (Object.keys(props || {}).length !== 0)
    $routerService?.pushToQuery({
      project_uuid: project_uuid,
      mission_uuid: mission_uuid,
      page: page,
      rowsPerPage: take,
      sortBy: sortBy,
      descending: descending
    })

  //////////////////////////
  // Fetch Data
  //////////////////////////

  // simulate loading; only useful for testing
  // TODO: we may want to remove this also in development mode
  if (process.env.NODE_ENV === 'development')
    await new Promise(resolve => setTimeout(resolve, 1000))

  let newData = [];
  let rowsNumber = 0;
  if (!!project_uuid && !mission_uuid) {
    newData = await missionsOfProject(project_uuid)
    currentDataType.value = DataType.MISSIONS;
  } else if (!!mission_uuid) {
    newData = await filesOfMission(mission_uuid)
    currentDataType.value = DataType.FILES;
  } else {
    const project_list_response = await allProjects(take, skip, sortBy, descending, searchParams)
    newData = project_list_response.projects
    rowsNumber = project_list_response.length;
    currentDataType.value = DataType.PROJECTS;
  }

  //////////////////////////
  // Update Data and Pagination
  //////////////////////////

  data.value = data.value || []; // initialize if null
  data.value.splice(0, data.value.length, ...newData);

  pagination.value.page = page
  pagination.value.rowsPerPage = take
  pagination.value.sortBy = sortBy
  pagination.value.descending = descending
  pagination.value.rowsNumber = rowsNumber

  isLoading.value = false;
}


const onRowClick = async (_: Event, row: any) => {

  if (currentDataType.value === DataType.PROJECTS) {
    $routerService?.routeTo(ROUTES.EXPLORER, {project_uuid: row.uuid})
    await loadData()
  } else if (currentDataType.value === DataType.MISSIONS) {
    $routerService?.routeTo(ROUTES.EXPLORER, {mission_uuid: row.uuid, project_uuid: route.query.project_uuid as string})
    await loadData()
  } else if (currentDataType.value === DataType.FILES) {
    $routerService?.routeTo(ROUTES.FILE, {uuid: row.uuid})
  }

}

// initial load
await loadData()

const props = defineProps({
  refresh: {type: Number, default: 0}
})

watch(() => props.refresh, async () => {
  await loadData()
})

</script>