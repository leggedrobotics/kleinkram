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
      <h2 class="text-h5 q-mb-xs">Explore all Files of Mission "{{ mission?.name }}"</h2>
      <HelpMessage/>
    </div>
  </template>
</template>

<script setup lang="ts">

import {watch} from "vue";
import HelpMessage from "components/HelpMessage.vue";

import {useDisplayType} from "src/hooks/utils";
import {useMissionQuery, useProjectQuery} from "src/hooks/customQueryHooks";

const project_uuid = defineModel<string | undefined>('project_uuid')
const mission_uuid = defineModel<string | undefined>('mission_uuid')

const {data: project, refetch: refetchProject} = useProjectQuery(project_uuid);
const {data: mission, refetch: refetchMission} = useMissionQuery(mission_uuid);

const {isListingProjects, isListingMissions, isListingFiles} = useDisplayType(project_uuid, mission_uuid)
watch(isListingProjects, () => (isListingProjects.value) && refetchProject())
watch(isListingMissions, () => (isListingMissions.value) && refetchMission())

</script>