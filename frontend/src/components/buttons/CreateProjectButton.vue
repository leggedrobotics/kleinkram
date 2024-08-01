<template>
  <q-btn
      color="primary"
      label="Create Project"
      @click="createNewProject"
  />
</template>

<script setup lang="ts">

import CreateProjectDialog from "src/dialogs/CreateProjectDialog.vue";
import {useQuasar} from "quasar";

const $q = useQuasar()
const createNewProject = () => $q.dialog({
  title: 'Create new project',
  component: CreateProjectDialog,
});

</script>