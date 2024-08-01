<template>

  <h1 class="text-h4 q-mt-xl" style="font-weight: 500">Project Explorer</h1>

  <div class="q-mb-md">
    <div class="flex justify-between q-mv-md">
      <ExplorerPageBreadcrumbs v-model:project_uuid="project_uuid" v-model:mission_uuid="mission_uuid"/>

      <ButtonGroup v-if="isListingMissions">
        <ManageProjectAccessButton :project_uuid="project_uuid"/>
        <q-btn outline color="primary" icon="sym_o_sell" label="Metadata">
          <q-tooltip> Manage Metadata Tags</q-tooltip>
        </q-btn>
        <DeleteProjectButton @onSuccessfulDelete="onProjectDeletion" :project_uuid="project_uuid"/>
        <q-btn icon="sym_o_more_horiz" outline disabled>
          <q-tooltip> More Actions</q-tooltip>
        </q-btn>
      </ButtonGroup>

      <ButtonGroup v-if="isListingFiles">
        <q-btn color="primary" outline icon="sym_o_lock" label="Access Rights">
          <q-tooltip>
            Manage Access to the Project
          </q-tooltip>
        </q-btn>
        <MoveMissionButton :mission_uuid="mission_uuid"/>
        <q-btn outline color="primary" icon="sym_o_analytics" label="Actions">
          <q-tooltip> Analyze Actions</q-tooltip>
        </q-btn>
        <q-btn outline color="red" icon="sym_o_delete"></q-btn>
        <q-btn icon="sym_o_more_horiz" outline disabled>
          <q-tooltip> More Actions</q-tooltip>
        </q-btn>
      </ButtonGroup>

    </div>
  </div>

  <q-card class="q-pa-md q-mb-md" flat bordered v-if="isListingMissions">


    <q-card-section class="flex justify-between items-center">

      <div>
        <h2 class="text-h5" style="font-weight: bold">
          {{ project?.name }}
        </h2>
        <span>
        {{ project?.description }}
      </span>

      </div>

      <div class="flex column q-mb-auto">
        <q-btn disabled outline icon="sym_o_edit" label="Edit Project">
          <q-tooltip> Edit Project</q-tooltip>
        </q-btn>
      </div>

    </q-card-section>
  </q-card>

  <q-card class="q-pa-md q-mb-md" flat bordered v-if="isListingFiles">


    <q-card-section class="flex justify-between items-center">

      <div>

        <h2 class="text-h5" style="font-weight: bold">
          {{ project?.name }} / {{ mission?.name }}
        </h2>

        <div class="flex">
          <span v-for="tag in mission?.tags" :key="tag.uuid" class="q-mr-xs">
            <q-chip square color="gray">
              {{ tag.type.name }}: {{ tag.asString() }}
            </q-chip>
          </span>
        </div>

      </div>

      <div class="flex column q-mb-auto">
        <q-btn disabled outline icon="sym_o_edit" label="Edit Mission">
          <q-tooltip> Edit Mission</q-tooltip>
        </q-btn>
      </div>

    </q-card-section>
  </q-card>

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

      <ButtonGroup>

        <q-btn outline @click="() => refresh++" color="grey-8" icon="sym_o_refresh">
          <q-tooltip> Refetch the Data</q-tooltip>
        </q-btn>

        <CreateMissionButton :project_uuid="project_uuid" v-if="isListingMissions"/>
        <CreateProjectButton v-if="isListingProjects"/>
        <UploadFileButton v-if="isListingFiles"/>

      </ButtonGroup>

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
import {useRoute, useRouter} from "vue-router";
import ROUTES from "src/router/routes";
import TableSearchHeader from "components/explorer_page/ExplorerPageTableSearchHeader.vue";
import {conditionalWatch, useDisplayType} from "src/hooks/utils";
import {useMissionQuery, useProjectQuery} from "src/hooks/customQueryHooks";
import CreateMissionButton from "components/buttons/CreateMissionButton.vue";
import CreateProjectButton from "components/buttons/CreateProjectButton.vue";
import UploadFileButton from "components/buttons/UploadFileButton.vue";
import DeleteProjectButton from "components/buttons/DeleteProjectButton.vue";
import ManageProjectAccessButton from "components/buttons/ManageProjectAccessButton.vue";
import MoveMissionButton from "components/buttons/MoveMissionButton.vue";
import ButtonGroup from "components/ButtonGroup.vue";

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
    ...JSON.parse(JSON.stringify(route.query)),
    project_uuid: project_uuid.value,
    mission_uuid: mission_uuid.value
  })
})

conditionalWatch(isListingProjects, () => {
  $routerService?.routeTo(ROUTES.EXPLORER, {
    ...JSON.parse(JSON.stringify(route.query)),
    project_uuid: undefined,
    mission_uuid: undefined
  })
});

conditionalWatch(isListingMissions, () => {
  $routerService?.routeTo(ROUTES.EXPLORER, {
    ...JSON.parse(JSON.stringify(route.query)),
    project_uuid: project_uuid.value,
    mission_uuid: undefined
  })
});

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

const {data: project} = useProjectQuery(project_uuid)
const {data: mission} = useMissionQuery(mission_uuid)

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


const onProjectDeletion = () => {
  // navigate back to the projects view
  $routerService?.routeTo(ROUTES.EXPLORER, {
    ...JSON.parse(JSON.stringify(route.query)),
    project_uuid: undefined,
    mission_uuid: undefined
  })

  // TODO: remove the following line
  refresh.value++;
}

</script>
