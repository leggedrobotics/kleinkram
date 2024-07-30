<template>
  <div class="row q-mb-md">
    <div>
      <q-breadcrumbs>
        <q-breadcrumbs-el
            v-for="crumb in crumbs"
            :key="crumb.uuid"
            :label="crumb.name"
            clickable
            @click="crumb.click"
        >
        </q-breadcrumbs-el>
      </q-breadcrumbs>
    </div>
  </div>

</template>

<script setup lang="ts">

import {ref, watch} from "vue";
import {getProject} from "src/services/queries/project";
import {getMission} from "src/services/queries/mission";
import {useQuery} from "@tanstack/vue-query";

const state = defineModel<ProjectMissionSelectionState>({required: true});

const {data: project} = useQuery({
  queryKey: ['project', state],
  queryFn: () => !!state.value?.project_uuid ? getProject(state.value.project_uuid) : undefined,
  enabled: !!state.value?.project_uuid
})

const {data: mission} = useQuery({
  queryKey: ['mission', state],
  queryFn: () => !!state.value?.mission_uuid ? getMission(state.value.mission_uuid) : undefined,
  enabled: !!state.value?.mission_uuid
})

const rootCrumb = {
  name: 'All Projects',
  uuid: 'projects',
  click: () => {
    state.value.project_uuid = undefined
    state.value.mission_uuid = undefined
  }
}

const crumbs = ref<any>([rootCrumb])

watch([project, mission, state], async () => {

  crumbs.value = [rootCrumb];

  if (state.value.project_uuid)
    crumbs.value.push({
      name: project.value?.name, uuid: 'missions',
      click: () => state.value.mission_uuid = undefined
    })


  if (state.value.mission_uuid)
    crumbs.value.push({
      name: mission.value?.name, uuid: 'files',
      click: () => {
      }
    })


}, {deep: true})


</script>