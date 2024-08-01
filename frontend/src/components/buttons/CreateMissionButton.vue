<template>

  <q-btn
      color="primary"
      label="Create Mission"
      @click="createNewMission"
  />

</template>

<script setup lang="ts">

import CreateMissionDialog from "src/dialogs/CreateMissionDialog.vue";
import {useQuasar} from "quasar";

const {project_uuid} = defineProps({
  project_uuid: String
})

const $q = useQuasar()

const createNewMission = () => $q.dialog({
  title: 'Create new mission',
  component: CreateMissionDialog,
  componentProps: {
    project_uuid: project_uuid
  },
})

</script>