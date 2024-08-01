<template>


  <q-table
      flat bordered
      ref="tableRef"
      :pagination="pagination"
      v-model:selected="selected"
      :rows="data"
      :columns="mission_columns as any"
      row-key="uuid"
      :loading="isLoading"
      binary-state-sort
      wrap-cells
      virtual-scroll
      separator="none"
      selection="multiple"
      @row-click="onRowClick"
  >

    <template v-slot:pagination="scope">
      <CustomPagination
          :page="scope.pagination.page"
          :rows-per-page="scope.pagination.rowsPerPage"
          :rows-number="scope.pagination.rowsNumber"
          @update:page="scope.setPagination"
      />

    </template>

    <template v-slot:loading>
      <q-inner-loading showing color="primary"/>
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
          <q-menu auto-close>
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
              <q-item clickable v-ripple @click="moveMission(props.row)">
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

import {QTable, useQuasar} from "quasar";
import {computed, ref, watch} from "vue";
import {missionsOfProject} from "src/services/queries/mission";
import { mission_columns} from "components/explorer_page/explorer_page_table_columns";
import MoveMission from "src/dialogs/MoveMissionDialog.vue";
import {QueryHandler} from "src/services/URLHandler";
import {useQuery} from "@tanstack/vue-query";
import CustomPagination from "components/explorer_page/CustomPagination.vue";

const props = defineProps({
  url_handler: {
    type: QueryHandler,
    required: true
  }
})

const selected = ref([])
const queryKey = computed(() => ['missions', props.url_handler.project_uuid, props.url_handler?.queryKey])

const {data, isLoading} = useQuery({
  queryKey: queryKey,
  queryFn: ()=>missionsOfProject(
      props.url_handler.project_uuid as string,
      props.url_handler?.take + 1,
      props.url_handler?.skip,
      props.url_handler?.sortBy,
      props.url_handler?.descending,
      props.url_handler?.search_params,
  )
})

watch(()=>data.value, ()=>{
  if(data.value){
    props.url_handler.nr_fetched = data.value.length
  }
})


const onRowClick = async (_: Event, row: any) => {
    props.url_handler?.setMissionUUID(row.uuid)
}

const $q = useQuasar()

const moveMission = (mission: any) => {
  $q.dialog({
    title: 'Move mission',
    component: MoveMission,
    persistent: false,
    style: 'max-width: 1500px',
    componentProps: {mission: mission},
  });
}


</script>