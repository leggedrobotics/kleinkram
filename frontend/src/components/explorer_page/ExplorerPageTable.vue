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

    <template v-slot:pagination="scope">

      <span class="q-table__bottom-item">
        {{ (scope.pagination.page - 1) * scope.pagination.rowsPerPage }} - {{
          Math.min(
              (scope.pagination.page - 1) * scope.pagination.rowsPerPage + scope.pagination.rowsPerPage, scope.pagination.rowsNumber)
        }} of {{
          (scope.pagination.page - 1) * scope.pagination.rowsPerPage + scope.pagination.rowsPerPage < scope.pagination.rowsNumber ? 'many' : scope.pagination.rowsNumber
        }}
      </span>


      <q-btn
          icon="chevron_left"
          color="grey-8"
          round
          dense
          flat
          :disable="scope.isFirstPage"
          @click="scope.prevPage"
      />

      <q-btn
          icon="chevron_right"
          color="grey-8"
          round
          dense
          flat
          :disable="scope.isLastPage"
          @click="scope.nextPage"
      />

    </template>

    <template v-slot:loading>
      <q-inner-loading showing color="primary"/>
    </template>

    <template v-slot:body-cell-projectaction="props">
      <q-td :props="props">

        <q-btn
            flat
            round
            dense
            icon="more_vert"
            unelevated
            color="primary"
            class="cursor-pointer"
            @click.stop
        >
          <q-menu>
            <q-list>
              <q-item clickable v-ripple @click="(e) => onRowClick(e, props.row)">
                <q-item-section>View Missions</q-item-section>
              </q-item>
              <q-item clickable v-ripple disabled>
                <q-item-section>Edit Metadata</q-item-section>
              </q-item>
              <q-item clickable v-ripple disabled>
                <q-item-section>Configure Tags</q-item-section>
              </q-item>
              <q-item clickable v-ripple disabled>
                <q-item-section>Manage Access</q-item-section>
              </q-item>
              <q-item clickable v-ripple disabled>
                <q-item-section>Delete</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

      </q-td>
    </template>

    <template v-slot:body-cell-missionaction="props">
      <q-td :props="props">

        <q-btn
            flat
            round
            dense
            icon="more_vert"
            unelevated
            color="primary"
            class="cursor-pointer"
            @click.stop
        >
          <q-menu>
            <q-list>
              <q-item clickable v-ripple @click="(e) => onRowClick(e, props.row)">
                <q-item-section>View Files</q-item-section>
              </q-item>
              <q-item clickable v-ripple disabled>
                <q-item-section>Edit Metadata</q-item-section>
              </q-item>
              <q-item clickable v-ripple disabled>
                <q-item-section>Manage Access</q-item-section>
              </q-item>
              <q-item clickable v-ripple disabled>
                <q-item-section>Move</q-item-section>
              </q-item>
              <q-item clickable v-ripple disabled>
                <q-item-section>Delete</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

      </q-td>
    </template>
    <template v-slot:body-cell-fileaction="props">
      <q-td :props="props">

        <q-btn
            flat
            round
            dense
            icon="more_vert"
            unelevated
            color="primary"
            class="cursor-pointer"
            @click.stop
        >
          <q-menu>
            <q-list>
              <q-item clickable v-ripple @click="(e) => onRowClick(e, props.row)">
                <q-item-section>View</q-item-section>
              </q-item>
              <q-item clickable v-ripple disabled>
                <q-item-section>Download</q-item-section>
              </q-item>
              <q-item clickable v-ripple disabled>
                <q-item-section>Move</q-item-section>
              </q-item>
              <q-item clickable v-ripple disabled>
                <q-item-section>Delete</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

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
const DEFAULT_PAGINATION = {page: 1, rowsPerPage: 10}

const state = defineModel<ProjectMissionSelectionState>({required: true});

const pagination = ref({
  sortBy: DEFAULT_SORT.sortBy,
  descending: DEFAULT_SORT.descending,
  page: Number(route.query.page) || DEFAULT_PAGINATION.page,
  rowsPerPage: Number(route.query.rowsPerPage) || DEFAULT_PAGINATION.rowsPerPage,
  rowsNumber: Number(route.query.rowsPerPage) + 1 || DEFAULT_PAGINATION.rowsPerPage + 1
})


// watch on route change
watch(() => route.query, async (query) => {
  await loadData()
})

const currentDataType = ref<DataType>(!!state.value.project_uuid ? DataType.MISSIONS : DataType.PROJECTS);
const data = ref<any>([]);

// load data based on current URL params and search
const loadData = async (props?: any) => {
  isLoading.value = true;

  //////////////////////////
  // Extract Data Fetching Parameters
  //////////////////////////

  const page = Number(props?.pagination?.page) || Number(route.query.page) || DEFAULT_PAGINATION.page;
  const take = Number(props?.pagination?.rowsPerPage) || Number(route.query.rowsPerPage) || DEFAULT_PAGINATION.rowsPerPage;
  const sortBy = props?.pagination?.sortBy || route.query.sortBy || DEFAULT_SORT.sortBy;
  const descending = (props?.pagination?.descending !== undefined) ? props?.pagination?.descending : (route.query.descending === 'true') || DEFAULT_SORT.descending;
  const skip = (page - 1) * take

  const searchParams = {name: route.query.search as string};

  //////////////////////////
  // update URL params
  //////////////////////////

  if (Object.keys(props || {}).length !== 0)
    $routerService?.pushToQuery({
      ...state.value.project_uuid ? {project_uuid: state.value.project_uuid} : {},
      ...state.value.mission_uuid ? {mission_uuid: state.value.mission_uuid} : {},
      page: page.toString(),
      rowsPerPage: take.toString(),
      sortBy: sortBy,
      descending: descending
    })

  //////////////////////////
  // Fetch Data
  //////////////////////////

  let newData = [];
  if (!!state.value.project_uuid && !state.value.mission_uuid) {
    newData = await missionsOfProject(state.value.project_uuid, take + 1, skip)
    currentDataType.value = DataType.MISSIONS;
  } else if (!!state.value.mission_uuid) {
    newData = await filesOfMission(state.value.mission_uuid)
    currentDataType.value = DataType.FILES;
  } else {
    newData = await allProjects(take + 1, skip, sortBy, descending, searchParams)
    currentDataType.value = DataType.PROJECTS;
  }

  //////////////////////////
  // Update Data and Pagination
  //////////////////////////

  // check if there is a next page
  const hasNextPage = newData.length > take;
  newData = newData.slice(0, take)

  if (hasNextPage) {
    pagination.value.rowsNumber = (page * take) + 1
  } else {
    pagination.value.rowsNumber = ((page - 1) * take) + newData.length
  }

  data.value = data.value || []; // initialize if null
  data.value.splice(0, data.value.length, ...newData)

  pagination.value.page = page
  pagination.value.rowsPerPage = take
  pagination.value.sortBy = sortBy
  pagination.value.descending = descending

  isLoading.value = false;
}


const onRowClick = async (_: Event, row: any) => {

  if (currentDataType.value === DataType.PROJECTS) {
    state.value.project_uuid = row.uuid
  } else if (currentDataType.value === DataType.MISSIONS) {
    state.value.mission_uuid = row.uuid
  } else if (currentDataType.value === DataType.FILES) {
    $routerService?.routeTo(ROUTES.FILE, {uuid: row.uuid})
    return;
  }

  await loadData()

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