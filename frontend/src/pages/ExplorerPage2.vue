<template>

  <h1 class="text-h4 q-mt-xl" style="font-weight: 500">Project Explorer</h1>

  <div class="q-mb-md">

    <ExplorerPageBreadcrumbs v-model="projectMissionSelectionState"/>

    <div class="flex justify-between items-center q-mt-md">
      <div></div>
      <q-btn
          color="primary"
          label="Create Project"
          @click="createNewProject"
      />
    </div>

  </div>

  <q-card class="q-pa-md q-mb-xl" flat bordered>

    <q-card-section class="flex justify-between items-center">

      <Suspense>
        <TableHeader v-model="projectMissionSelectionState"/>

        <template #fallback>
          <div style="width: 550px; height: 67px;">
            <q-skeleton class="q-mr-md q-mb-sm q-mt-sm" style="width: 300px; height: 20px"/>
            <q-skeleton class="q-mr-md" style="width: 200px; height: 18px"/>
          </div>
        </template>

      </Suspense>

      <q-btn outline @click="() => refresh++" color="grey-8" icon="refresh"/>
    </q-card-section>

    <q-card-section style="padding-top: 10px">
      <q-input debounce="300" outlined v-model="search" label="Project Name" placeholder="Search for projects...">
        <template v-slot:append>
          <q-icon name="close" @click="search = ''" class="cursor-pointer"/>
        </template>
      </q-input>
    </q-card-section>

    <q-card-section>
      <Suspense>
        <ExplorerPageTable :refresh="refresh" v-model="projectMissionSelectionState"/>

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

import {inject, ref, watch, watchEffect} from "vue";
import ExplorerPageTable from "components/explorer_page/ExplorerPageTable.vue";
import ExplorerPageBreadcrumbs from "components/explorer_page/ExplorerPageBreadcrumbs.vue";
import RouterService from "src/services/routerService";
import TableHeader from "components/explorer_page/TableHeader.vue";
import CreateProjectDialog from "components/CreateProjectDialog.vue";
import {useQuasar} from "quasar";
import {useRoute} from "vue-router";
import ROUTES from "src/router/routes";

const $routerService: RouterService | undefined = inject('$routerService');

const route = useRoute()
const projectMissionSelectionState = ref<ProjectMissionSelectionState>(
    {project_uuid: route.query.project_uuid as string, mission_uuid: route.query.mission_uuid as string}
);


// update URL on state change
watchEffect(() => {
  if (projectMissionSelectionState.value.project_uuid && projectMissionSelectionState.value?.mission_uuid) {
    $routerService?.routeTo(ROUTES.EXPLORER, {
      project_uuid: projectMissionSelectionState.value.project_uuid,
      mission_uuid: projectMissionSelectionState.value.mission_uuid
    })
  } else if (projectMissionSelectionState.value.project_uuid && !projectMissionSelectionState.value?.mission_uuid) {
    $routerService?.routeTo(ROUTES.EXPLORER, {project_uuid: projectMissionSelectionState.value.project_uuid})
  } else {
    $routerService?.routeTo(ROUTES.EXPLORER)
  }
})

// update change on URL change
watchEffect(() => {
  projectMissionSelectionState.value = {
    project_uuid: route.query.project_uuid as string,
    mission_uuid: route.query.mission_uuid as string
  }
})

const search = ref('')
const refresh = ref(0);

watch(search, () => {
  $routerService?.pushToQuery({search: search.value})
  refresh.value++;
})

const $q = useQuasar();

const createNewProject = () => $q.dialog({
  title: 'Create new project',
  component: CreateProjectDialog,
}).onOk(() => {

  // TODO: set search to new project name....
  // search.value = 'new project name'

})


</script>
