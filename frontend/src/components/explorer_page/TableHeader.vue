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

const state = defineModel<ProjectMissionSelectionState>({required: true});


import {ref, watch} from "vue";
import {getProject} from "src/services/queries/project";
import {getMission} from "src/services/queries/mission";
import HelpMessage from "components/HelpMessage.vue";
import {useQuery} from "@tanstack/vue-query";


const isListingProjects = ref(true);
const isListingMissions = ref(false);
const isListingFiles = ref(false);

const {data: project, refetch: refetchProject} = useQuery({
  queryKey: ['project', state],
  queryFn: () => !!state.value.project_uuid ? getProject(state.value.project_uuid) : undefined,
  enabled: !!state.value.project_uuid,
});

const {data: mission, refetch: refetchMission} = useQuery({
  queryKey: ['mission', state],
  queryFn: () => !!state.value.mission_uuid ? getMission(state.value.mission_uuid) : undefined,
  enabled: !!state.value.mission_uuid
});


watch(state, () => {

  if (state.value.project_uuid && !state.value.mission_uuid) {
    isListingProjects.value = false;
    isListingMissions.value = true;
    isListingFiles.value = false;

    refetchProject()

  } else if (state.value.mission_uuid) {
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

}, {deep: true})


</script>