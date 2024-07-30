<template :refresh="refresh">

  <template v-if="!isLoading">

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
        @request="() => console.log('requesting data')"
    >
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

  <template v-else>
    <ExplorerPageLoadingPreview/>
  </template>

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
import ExplorerPageLoadingPreview from "components/explorer_page/ExplorerPageLoadingPrview.vue";

const $routerService: RouterService | undefined = inject('$routerService');
const route = useRoute()
const isLoading = ref(true);

const selected = ref([])
watch(() => selected.value, (selected) => {
  console.log(selected)
})

const pagination = ref({
  sortBy: 'name',
  descending: false,
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 1_000_000
})

// watch on route change
watch(() => route.query, async (query) => {
  await loadData(query.project_uuid as string, query.mission_uuid as string)
})

const currentDataType = ref<DataType>(!!route.query.project_uuid ? DataType.MISSIONS : DataType.PROJECTS);
const data = ref<any>(null);

// load data based on current URL params and search
const loadData = async (project_uuid: string | undefined = undefined, mission_uuid: string | undefined = undefined) => {
  isLoading.value = true;
  if (!!project_uuid && !mission_uuid) {
    data.value = await missionsOfProject(project_uuid)
    currentDataType.value = DataType.MISSIONS;
  } else if (!!mission_uuid) {
    data.value = await filesOfMission(mission_uuid)
    currentDataType.value = DataType.FILES;
  } else {
    data.value = await allProjects(pagination.value.rowsPerPage, pagination.value.page * pagination.value.rowsPerPage)
    currentDataType.value = DataType.PROJECTS;
  }

  // await new Promise(resolve => setTimeout(resolve, 10_000))
  isLoading.value = false;
}


const onRowClick = async (_: Event, row: any) => {

  if (currentDataType.value === DataType.PROJECTS) {
    $routerService?.routeTo(ROUTES.EXPLORER, {project_uuid: row.uuid})
    await loadData(row.uuid, undefined)
  } else if (currentDataType.value === DataType.MISSIONS) {
    $routerService?.routeTo(ROUTES.EXPLORER, {mission_uuid: row.uuid, project_uuid: route.query.project_uuid as string})
    await loadData(undefined, row.uuid)
  } else if (currentDataType.value === DataType.FILES) {
    $routerService?.routeTo(ROUTES.FILE, {uuid: row.uuid})
  }

}

// initial load
await loadData(route.query.project_uuid as string, route.query.mission_uuid as string)

const forceReload = async () => {
  await loadData(route.query.project_uuid as string, route.query.mission_uuid as string)
}

const props = defineProps({
  refresh: {type: Number, default: 0}
})

watch(() => props.refresh, async () => {
  await forceReload()
})

</script>