<template>
  <template v-if="isListingProjects">
    <div>
      <h2 class="text-h5 q-mb-xs">Explore all Projects</h2>
      <HelpMessage
          text="You can only see projects on which you have at least view access on project level."
          link="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
      />
    </div>
  </template>

  <template v-if="isListingMissions">
    <div>
      <h2 class="text-h6 q-mb-xs">Explore all Missions of Project</h2>
      <HelpMessage
          text="You can only see missions on which you have at least view access on project level or mission level."
          link="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
      />
    </div>
  </template>

  <template v-if="isListingFiles">
    <div>
      <h2 class="text-h6 q-mb-xs">Explore all Files of Mission</h2>
      <HelpMessage
          text="You can only see files of missions you have access to."
          link="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
      />
    </div>
  </template>
</template>

<script setup lang="ts">

import HelpMessage from "components/HelpMessage.vue";

import {useDisplayType} from "src/hooks/utils";

const project_uuid = defineModel<string | undefined>('project_uuid')
const mission_uuid = defineModel<string | undefined>('mission_uuid')

const {isListingProjects, isListingMissions, isListingFiles} = useDisplayType(project_uuid, mission_uuid)

</script>