<template>

  <h1 class="text-h4 q-mt-xl" style="font-weight: 500">Project Explorer</h1>

  <div class="q-mb-md">

    <ExplorerPageBreadcrumbs v-model:project_uuid="project_uuid" v-model:mission_uuid="mission_uuid"/>

    <div class="flex justify-between items-center q-mt-md" v-if="isListingProjects">
      <div></div>
      <q-btn
          color="primary"
          label="Create Project"
          @click="createNewProject"
      />
    </div>

    <div class="flex justify-between items-center q-mt-md" v-if="isListingMissions">
      <div></div>
      <q-btn
          color="primary"
          label="Create Mission"
          @click="createNewMission"
      />
    </div>

    <div class="flex justify-between items-center q-mt-md" v-if="isListingFiles">
      <div></div>
      <q-btn
          color="primary"
          label="Upload File"
          @click="() => $q.notify('Not implemented yet! Use upload page instead.')"
      />
    </div>

  </div>

  <q-card class="q-pa-md q-mb-xl" flat bordered>

    <q-card-section class="flex justify-between items-center">

      <Suspense>
        <TableHeader v-model:project_uuid="project_uuid" v-model:mission_uuid="mission_uuid"/>

        <template #fallback>
          <div style="width: 550px; height: 67px;">
            <q-skeleton class="q-mr-md q-mb-sm q-mt-sm" style="width: 300px; height: 20px"/>
            <q-skeleton class="q-mr-md" style="width: 200px; height: 18px"/>
          </div>
        </template>

      </Suspense>

      <q-btn outline @click="() => refresh++" color="grey-8" icon="refresh">
        <q-tooltip delay="600"> Refetch the Data </q-tooltip>
      </q-btn>

    </q-card-section>

    <q-card-section style="padding-top: 10px">
      <Suspense>
        <TableSearchHeader v-model:project_uuid="project_uuid" v-model:mission_uuid="mission_uuid"
                           v-model:search="search" v-model:file_type_filter="file_type_filter"/>

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
        <ExplorerPageTable :refresh="refresh" v-model:project_uuid="project_uuid" v-model:mission_uuid="mission_uuid"/>

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
import TableHeader from "components/explorer_page/ExplorerPageTableHeader.vue";
import CreateProjectDialog from "src/dialogs/CreateProjectDialog.vue";
import {useQuasar} from "quasar";
import {useRoute, useRouter} from "vue-router";
import ROUTES from "src/router/routes";
import CreateMissionDialog from "src/dialogs/CreateMissionDialog.vue";
import TableSearchHeader from "components/explorer_page/ExplorerPageTableSearchHeader.vue";
import {conditionalWatch, useDisplayType} from "src/hooks/utils";

const $routerService: RouterService | undefined = inject('$routerService')
const route = useRoute()

const project_uuid = ref<string | undefined>(undefined);
const mission_uuid = ref<string | undefined>(undefined);

const {isListingProjects, isListingMissions, isListingFiles} = useDisplayType(project_uuid, mission_uuid);

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
// update the URL on navigation between project, mission and files view
//////////////////////////////////////////////////////////////////////////////////////////

conditionalWatch(isListingFiles, () => {
  $routerService?.routeTo(ROUTES.EXPLORER, {
    project_uuid: project_uuid.value,
    mission_uuid: mission_uuid.value,
    ...JSON.parse(JSON.stringify(route.query))
  })
})

conditionalWatch(isListingProjects, () => {
  $routerService?.routeTo(ROUTES.EXPLORER, {
    project_uuid: undefined,
    mission_uuid: undefined,
    ...JSON.parse(JSON.stringify(route.query))
  })
});

conditionalWatch(isListingMissions, () => {
  $routerService?.routeTo(ROUTES.EXPLORER, {
    project_uuid: project_uuid.value,
    mission_uuid: undefined,
    ...JSON.parse(JSON.stringify(route.query))
  })
});

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////


const search = ref('')
const file_type_filter = ref('MCAP')

// update change on URL change
watchEffect(() => {
  project_uuid.value = route.query.project_uuid as string;
  mission_uuid.value = route.query.mission_uuid as string
  search.value = route.query.search as string || ''
  file_type_filter.value = route.query.file_type_filter as string || 'MCAP'
})

const refresh = ref(0);

const router = useRouter()

watch(search, async () => {
  await router.push({query: {...route.query, search: search.value}})
  refresh.value++;
})

watch(file_type_filter, () => {
  $routerService?.pushToQuery({file_type_filter: file_type_filter.value})
  refresh.value++;
});

const $q = useQuasar();

const createNewProject = () => $q.dialog({
  title: 'Create new project',
  component: CreateProjectDialog,
}).onOk(() => {

  // TODO: set search to new project name....
  // search.value = 'new project name'

})

const createNewMission = () => $q.dialog({
  title: 'Create new mission',
  component: CreateMissionDialog,
  componentProps: {
    project_uuid: project_uuid.value
  },
}).onOk(() => {

  // ...

})


</script>
