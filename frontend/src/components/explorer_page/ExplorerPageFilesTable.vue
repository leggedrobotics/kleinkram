<template>


  <q-table
      flat bordered
      ref="tableRef"
      :pagination="url_handler.pagination"
      v-model:selected="selected"
      :rows="data"
      :columns="file_columns as any"
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
          <q-menu auto-close>
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
import {computed, inject, ref, watch} from "vue";

import RouterService from "src/services/routerService";
import {filesOfMission} from "src/services/queries/file";
import ROUTES from "src/router/routes";
import {file_columns} from "components/explorer_page/explorer_page_table_columns";
import {QueryHandler} from "src/services/URLHandler";
import {useQuery} from "@tanstack/vue-query";

const $routerService: RouterService | undefined = inject('$routerService');

const props = defineProps({
  url_handler: {
    type: QueryHandler,
    required: true
  }
})

const selected = ref([])
const queryKey = computed(() => ['files', props.url_handler.mission_uuid, props.url_handler?.queryKey, props.url_handler.file_type])

const {data, isLoading} = useQuery({
  queryKey: queryKey,
  queryFn: ()=>filesOfMission(
      props.url_handler.mission_uuid as string,
      props.url_handler?.take,
      props.url_handler?.skip,
      props.url_handler.file_type,
      props.url_handler?.search_params.name,
  )
})

watch(()=>data.value, ()=>{
  if(data.value){
    props.url_handler.hasNextPage = data.value.length > props.url_handler.take
  }})


const onRowClick = async (_: Event, row: any) => {
    $routerService?.routeTo(ROUTES.FILE, {uuid: row.uuid})
}




</script>