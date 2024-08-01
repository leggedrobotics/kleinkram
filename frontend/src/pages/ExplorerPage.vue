<template>

  <h1 class="text-h4 q-mt-xl" style="font-weight: 500">Project Explorer</h1>

  <div class="q-mb-md">
    <div class="flex justify-between q-mv-md" >
      <ExplorerPageBreadcrumbs :url_handler="handler"/>
      <q-btn
          v-if="handler.isListingProjects"
          color="primary"
          label="Create Project"
          @click="createNewProject"
      />
      <div
          v-if="handler.isListingMissions"
      >

        <q-btn
            class="q-mr-md"
            color="primary"
            outline
            label="Manage Access"
            @click="manageProjectAccess"
        >
          <q-tooltip :delay="600">
            Manage how can access this project.
          </q-tooltip>
        </q-btn>

        <q-btn
            color="primary"
            label="Create Mission"
            @click="createNewMission"
        />

      </div>

      <div
          v-if="handler.isListingFiles"
      >

        <q-btn
            class="q-mr-md"
            color="primary"
            outline
            label="Move Mission"
            @click="moveMissionToDifferentProject">

          <q-tooltip :delay="600">
            Move the mission to a different project.
          </q-tooltip>

        </q-btn>

        <q-btn
            color="primary"
            label="Upload File"
            @click="() => $q.notify('Not implemented yet! Use upload page instead.')"
        />
      </div>
    </div>

  </div>

  <q-card class="q-pa-md q-mb-md" flat bordered v-if="handler.isListingMissions">
    <q-card-section class="container">
      <h2 class="text-h5" style="font-weight: bold">
        {{ project?.name }}
      </h2>
      <span>
        {{ project?.description }}
      </span>
    </q-card-section>
  </q-card>

  <q-card class="q-pa-md q-mb-xl" flat bordered>
    <q-card-section class="flex justify-between items-center">
      <Suspense>

        <TableHeader :url_handler="handler" v-if="handler"/>

        <template #fallback>
          <div style="width: 550px; height: 67px;">
            <q-skeleton class="q-mr-md q-mb-sm q-mt-sm" style="width: 300px; height: 20px"/>
            <q-skeleton class="q-mr-md" style="width: 200px; height: 18px"/>
          </div>
        </template>
      </Suspense>

      <q-btn outline @click="() => refresh()" color="grey-8" icon="refresh">
        <q-tooltip :delay="600"> Refetch the Data</q-tooltip>
      </q-btn>

    </q-card-section>

    <q-card-section style="padding-top: 10px">
      <Suspense>

        <TableSearchHeader :url_handler="handler" v-if="handler"/>

        <template #fallback>
          <div style="width: 550px; height: 67px;">
            <q-skeleton class="q-mr-md q-mb-sm q-mt-sm" style="width: 300px; height: 20px"/>
            <q-skeleton class="q-mr-md" style="width: 200px; height: 18px"/>
          </div>
        </template>
      </Suspense>
    </q-card-section>

    <q-card-section>
      <Suspense>

        <Component :is="getComponent()" :url_handler="handler" v-if="handler" />

        <template #fallback>
          <div style="width: 100%; height: 645px;">
            <q-skeleton class="q-mr-md q-mb-sm q-mt-sm" style="width: 100%; height: 40px"/>

            <div v-for="i in 20" :key="i" class="q-mt-sm">
              <q-skeleton class="q-mr-md q-mb-sm" style="width: 100%; height: 20px; opacity: 0.5"/>
            </div>

          </div>
        </template>
      </Suspense>
    </q-card-section>

  </q-card>
</template>
<script setup lang="ts">

import {computed, Ref, ref} from "vue";
import ExplorerPageBreadcrumbs from "components/explorer_page/ExplorerPageBreadcrumbs.vue";
import TableHeader from "components/explorer_page/ExplorerPageTableHeader.vue";
import CreateProjectDialog from "src/dialogs/CreateProjectDialog.vue";
import {useQuasar} from "quasar";
import { useRouter} from "vue-router";
import CreateMissionDialog from "src/dialogs/CreateMissionDialog.vue";
import TableSearchHeader from "components/explorer_page/ExplorerPageTableSearchHeader.vue";
import AccessRightsDialog from "src/dialogs/AccessRightsDialog.vue";
import MoveMissionDialog from "src/dialogs/MoveMissionDialog.vue";
import {useProjectQuery} from "src/hooks/customQueryHooks";
import {QueryURLHandler} from "src/services/URLHandler";
import {useQueryClient} from "@tanstack/vue-query";
import ExplorerPageMissionTable from "components/explorer_page/ExplorerPageMissionTable.vue";
import ExplorerPageProjectTable from "components/explorer_page/ExplorerPageProjectTable.vue";
import ExplorerPageFilesTable from "components/explorer_page/ExplorerPageFilesTable.vue";
const queryClient = useQueryClient();

const router = useRouter()

const handler: Ref<QueryURLHandler> = ref(new QueryURLHandler()) as unknown as Ref<QueryURLHandler>;
handler.value.setRouter(router)

const project_uuid = computed(() => handler.value.project_uuid)

const {data: project} = useProjectQuery(project_uuid)

function refresh(){
  if(handler.value.isListingProjects){
    queryClient.invalidateQueries({
      queryKey: ['projects']
    })
  }
  if(handler.value.isListingMissions){
    queryClient.invalidateQueries({
      queryKey: ['missions', handler.value.project_uuid]
    })
  }
  if(handler.value.isListingFiles) {
    queryClient.invalidateQueries({
      queryKey: ['files', handler.value.mission_uuid]
    })
  }
}

function getComponent(){
  if(handler.value.isListingProjects){
    return ExplorerPageProjectTable
  }else if(handler.value.isListingMissions){
    return ExplorerPageMissionTable
  }else if(handler.value.isListingFiles){
    return ExplorerPageFilesTable
  }
  console.log('No component found')
  return ExplorerPageProjectTable
}

const $q = useQuasar();

const createNewProject = () => $q.dialog({
  title: 'Create new project',
  component: CreateProjectDialog,
}).onOk(() => {
})

const createNewMission = () => $q.dialog({
  title: 'Create new mission',
  component: CreateMissionDialog,
  componentProps: {
    project_uuid: handler.value.project_uuid
  },
}).onOk(() => {
})

const manageProjectAccess = () => $q.dialog({
  title: 'Manage Access',
  component: AccessRightsDialog,
  componentProps: {
    project_uuid: handler.value.project_uuid
  },
}).onOk(() => {
})

const moveMissionToDifferentProject = () => $q.dialog({
  title: 'Move Mission',
  component: MoveMissionDialog,
  componentProps: {
    mission: handler.value.mission_uuid
  },
}).onOk(() => {
})


</script>
