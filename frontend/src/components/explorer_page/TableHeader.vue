<template>
  <template v-if="isListingProjects">
    <div>
      <h2 class="text-h5 q-mb-xs">Explore all Projects</h2>
      <HelpMessage/>
    </div>
  </template>

  <template v-if="isListingMissions">
    <div>
      <h2 class="text-h5 q-mb-xs">Explore all Missions of Project "{{ project?.name }}"</h2>
      <HelpMessage/>
    </div>
  </template>

  <template v-if="isListingFiles">
    <div>
      <h2 class="text-h5 q-mb-xs">Explore all Files of Mission "{{ mission?.name }}" of Project "{{
          project?.name
        }}"</h2>
      <HelpMessage/>
    </div>
  </template>
</template>

<script setup lang="ts">

import {ref, watch} from "vue";
import {LocationQuery, useRoute} from "vue-router";
import {getProject} from "src/services/queries/project";
import {getMission} from "src/services/queries/mission";
import HelpMessage from "components/HelpMessage.vue";
import {useQuery} from "@tanstack/vue-query";

const route = useRoute()

const isListingProjects = ref(true);
const isListingMissions = ref(false);
const isListingFiles = ref(false);


const {data: project, refetch: refetchProject} = useQuery({
  queryKey: ['project', route.query.project_uuid],
  queryFn: () => getProject(route.query.project_uuid as string),
  enabled: !!route.query.project_uuid
});

const {data: mission, refetch: refetchMission} = useQuery({
  queryKey: ['mission', route.query.mission_uuid],
  queryFn: () => getMission(route.query.mission_uuid as string),
  enabled: !!route.query.mission_uuid
});

const updateData = async (query: LocationQuery) => {

  await new Promise(resolve => setTimeout(resolve, 1000))

  if (query.project_uuid && !query.mission_uuid) {
    isListingProjects.value = false;
    isListingMissions.value = true;
    isListingFiles.value = false;

    refetchProject()

  } else if (query.mission_uuid) {
    isListingProjects.value = false;
    isListingMissions.value = false;
    isListingFiles.value = true;

    refetchMission()

    if (!!mission.value?.project?.uuid) {
      refetchProject()
    }

  } else {
    isListingProjects.value = true;
    isListingMissions.value = false;
    isListingFiles.value = false;
  }
}

watch(() => route.query, async (query) => {
  await updateData(query)
})

// initial load
await updateData(route.query)


</script>