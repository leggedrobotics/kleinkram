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
import {Project} from "src/types/Project";
import {Mission} from "src/types/Mission";
import {LocationQuery, useRoute} from "vue-router";
import {getProject} from "src/services/queries/project";
import {getMission} from "src/services/queries/mission";
import HelpMessage from "components/HelpMessage.vue";

const route = useRoute()

const isListingProjects = ref(true);
const isListingMissions = ref(false);
const isListingFiles = ref(false);

const project = ref<Project | null>(null);
const mission = ref<Mission | null>(null);

const updateData = async (query: LocationQuery) => {

  await new Promise(resolve => setTimeout(resolve, 1000))

  if (query.project_uuid && !query.mission_uuid) {
    isListingProjects.value = false;
    isListingMissions.value = true;
    isListingFiles.value = false;

    project.value = await getProject(query.project_uuid as string);

  } else if (query.mission_uuid) {
    isListingProjects.value = false;
    isListingMissions.value = false;
    isListingFiles.value = true;

    mission.value = await getMission(query.mission_uuid as string);

    if (!!mission.value?.project?.uuid) {
      project.value = await getProject(mission.value.project.uuid);
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