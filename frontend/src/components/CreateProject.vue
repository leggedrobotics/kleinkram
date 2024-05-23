<template>
  <q-card-section>
    <h3 class="text-h6">Create new project</h3>
    <div class="row justify-between q-gutter-md">
      <div class="col-9">
        <q-form @submit="submitNewProject">
          <div class="row justify-between">
            <div class="col-3">
              <q-input
                v-model="projectName"
                label="Project Name"
                outlined
                dense
                clearable
                required
              />
            </div>
            <div class="col-8">
              <q-input
                v-model="projectDescription"
                label="Project Description"
                type="textarea"
                autogrow
                :rows="4"
                outlined
                dense
                clearable
              />
            </div>
          </div>
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
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';

const projectName = ref('');
const projectDescription = ref('');
const queryClient = useQueryClient();

const submitNewProject = async () => {
  await createProject(projectName.value, projectDescription.value);
  const cache = queryClient.getQueryCache();
  const filtered = cache.getAll().filter((query) => query.queryKey[0] === 'projects');
  filtered.forEach((query) => {
    queryClient.invalidateQueries(query.queryKey);
  });
  Notify.create({
    message: `Project ${projectName.value} created`,
    color: 'positive',
    spinner: false,
    timeout: 4000,
    position: 'top-right',
  })
  projectName.value = '';
  projectDescription.value = '';
};


</script>
<style scoped>

</style>
