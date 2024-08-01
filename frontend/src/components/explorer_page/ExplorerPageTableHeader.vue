<template>
  <template v-if="url_handler.isListingProjects">
    <div>
      <h2 class="text-h5 q-mb-xs">
        Explore all Projects
      </h2>
      <HelpMessage
        text="You can only see projects on which you have at least view access on project level."
        link="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
      />
    </div>
  </template>

  <template v-if="url_handler.isListingMissions">
    <div>
      <h2 class="text-h6 q-mb-xs">
        Explore all Missions of Project
      </h2>
      <HelpMessage
        text="You can only see missions on which you have at least view access on project level or mission level."
        link="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
      />
    </div>
  </template>

  <template v-if="url_handler.isListingFiles">
    <div>
      <h2 class="text-h6 q-mb-xs">
        Explore all Files of Mission
      </h2>
      <HelpMessage
        text="You can only see files of missions you have access to."
        link="https://docs.datasets.leggedrobotics.com/usage/getting-started.html"
      />
    </div>
  </template>
</template>

<script setup lang="ts">

import HelpMessage from "components/HelpMessage.vue";

import {QueryHandler} from "src/services/URLHandler";
const props = defineProps({
  url_handler: {
    type: QueryHandler,
    required: true
  }
})

</script>