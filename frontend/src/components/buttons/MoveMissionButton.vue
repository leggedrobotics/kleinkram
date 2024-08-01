<template>
  <q-btn
      class="q-mr-md"
      color="primary"
      outline
      label="Move Mission"
      @click="moveMissionToDifferentProject">

    <q-tooltip :delay="600">
      Move the mission to a different project.
    </q-tooltip>

  </q-btn>
</template>

<script setup lang="ts">

import MoveMissionDialog from "src/dialogs/MoveMissionDialog.vue";
import {useQuasar} from "quasar";

const {mission_uuid} = defineProps({
  mission_uuid: String
})

const $q = useQuasar()

const moveMissionToDifferentProject = () => $q.dialog({
  title: 'Move Mission',
  component: MoveMissionDialog,
  componentProps: {
    mission: mission_uuid
  },
});

</script>