<template>
  <q-btn
      color="primary"
      outline
      icon="sym_o_move_down"
      label="Move"
      @click="moveMissionToDifferentProject">

    <q-tooltip>
      Move the Mission another Project
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