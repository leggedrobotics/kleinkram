<template>
  <q-card-section>
    <h3 class="text-h6">Create new run</h3>
    <div class="row justify-between q-gutter-md">
      <div class="col-5">
        <q-form @submit="submitNewRun">
          <div class="row items-center justify-between q-gutter-md">
            <div class="col-5">
              <q-input
                v-model="runName"
                label="Run Name"
                outlined
                dense
                clearable
                required
              />
            </div>
            <div class="col-4">
              <q-btn-dropdown
                v-model="ddr_open"
                :label="selected_project?.name || 'Project'"
                outlined
                dense
                clearable
                required
              >
                <q-list>
                  <q-item
                    v-for="project in data"
                    :key="project.uuid"
                    clickable
                    @click="selected_project = project; ddr_open=false"
                  >
                    <q-item-section>
                      <q-item-label>
                        {{ project.name }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-btn-dropdown>
            </div>
          </div>
        </q-form>
      </div>
      <div class="col-2">
        <q-btn
          label="Submit"
          color="primary"
          @click="submitNewRun"/>
      </div>
    </div>
  </q-card-section>
</template>


<script setup lang="ts">
import { ref, Ref } from 'vue';
import { Project } from 'src/types/types';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { allProjects } from 'src/services/queries';
import { createRun } from 'src/services/mutations';
import { Notify } from 'quasar';
const queryClient = useQueryClient();

const selected_project: Ref<Project | null> = ref(null);
const runName = ref('');
const ddr_open = ref(false);
const { isLoading, isError, data, error } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: allProjects });

const submitNewRun = async () => {
  if (!selected_project.value) {
    return;
  }
  await createRun(runName.value, selected_project.value.uuid)
  const cache = queryClient.getQueryCache();
  const filtered = cache.getAll().filter((query) => query.queryKey[0] === 'runs' && query.queryKey[1] === selected_project.value?.uuid);
  filtered.forEach((query) => {
    queryClient.invalidateQueries(query.queryKey);
  });
  Notify.create({
    message: `Run ${runName.value} created`,
    color: 'positive',
    spinner: false,
    timeout: 4000,
    position: 'top-right',
  })
  runName.value = '';
};
</script>

<style scoped>

</style>
