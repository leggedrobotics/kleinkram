<template>


  <q-table
      flat bordered
      ref="tableRef"
      :pagination="url_handler.pagination"
      v-model:selected="selected"
      :rows="data"
      :columns="explorer_page_table_columns as any"
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
          <q-menu auto-close>
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
              <q-item clickable v-ripple @click="() => manageAccessRights(props.row.uuid)">
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
  </q-table>

</template>


<script setup lang="ts">

import { QTable, useQuasar} from "quasar";
import {computed, ref, watch} from "vue";
import {explorer_page_table_columns} from "components/explorer_page/explorer_page_table_columns";
import AccessRightsDialog from "src/dialogs/AccessRightsDialog.vue";
import {QueryHandler} from "src/services/URLHandler";
import {useQuery} from "@tanstack/vue-query";
import {filteredProjects} from "src/services/queries/project";

const $q = useQuasar()

const props = defineProps({
  url_handler: {
    type: QueryHandler,
    required: true
  }
})

const queryKey = computed(() => ['projects', props.url_handler?.queryKey])
const selected = ref([])

const {data, isLoading} = useQuery({
  queryKey: queryKey,
  queryFn: ()=>filteredProjects(
      props.url_handler?.take,
      props.url_handler?.skip,
      props.url_handler?.sortBy,
      props.url_handler?.descending,
      props.url_handler?.search_params,
  ),
})

watch(()=>data.value, ()=>{
  if(data.value){
    props.url_handler.hasNextPage = data.value.length > props.url_handler.take
  }})

const onRowClick = async (_: Event, row: any) => {
  props.url_handler?.setProjectUUID(row.uuid)
}


const manageAccessRights = (project_uuid: string) => {
  $q.dialog({
    component: AccessRightsDialog,
    componentProps: {
      project_uuid: project_uuid,
    },
  });
}

</script>