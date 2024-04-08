<template>
  <q-card-section>
    <h3 class="text-h6">Create new project</h3>
    <div class="row justify-between q-gutter-md">
      <div class="col-5">
        <q-form @submit="submitNewProject">
          <q-input
            v-model="projectName"
            label="Project Name"
            outlined
            dense
            clearable
            required
          />
        </q-form>
      </div>
      <div class="col-2">
        <q-btn
          label="Submit"
          color="primary"
          @click="submitNewProject"/>
      </div>
    </div>
  </q-card-section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { createProject } from 'src/services/mutations';

const projectName = ref('');
const submitNewProject = async () => {
  const new_project = await createProject(projectName.value )
};

</script>
<style scoped>

</style>
