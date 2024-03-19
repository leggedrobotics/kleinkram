<template>
  <q-card>
    <q-card-section>
      <h3 class="text-h6">Create new project</h3>
      <div class="row justify-between q-gutter-md">
        <div class="col-5">
          <q-form @submit="submitNewProject">
            <q-input
              v-model="name"
              label="Name"
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
    <q-card-section>
      <h3 class="text-h6">Create new run</h3>
      <q-form @submit.prevent="submitNewProject">
        <div class="row items-center justify-between q-gutter-md">
          <div class="col-5">
            <q-input
              v-model="run_name"
              label="Name"
              outlined
              dense
              clearable
              required
            />
          </div>
          <div class="col-1">
            <q-btn-dropdown
              v-model="dd_open"
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
                  @click="selected_project = project; dd_open=false"
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
          <div class="col-3">
            <div class="q-pa-md" style="max-width: 300px">
              <q-input filled v-model="dateTime">
                <template v-slot:prepend>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="dateTime" :mask="dateMask">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Close" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>

                <template v-slot:append>
                  <q-icon name="access_time" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-time v-model="dateTime" :mask="dateMask" format24h>
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Close" color="primary" flat />
                        </div>
                      </q-time>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="col-1">
            <q-file outlined v-model="file">
              <template v-slot:prepend>
                <q-icon name="attach_file" />
              </template>
            </q-file>
          </div>
          <div class="col-1">
              <q-btn
                label="Submit"
                color="primary"
                @click="submitNewRun"/>
            </div>
        </div>
      </q-form>

    </q-card-section>

  </q-card>
</template>
<script setup lang="ts">
import { Ref, ref } from 'vue';
import { createProject, createRun } from 'src/services/mutations';
import { allProjects } from 'src/services/queries';
import { useQuery } from '@tanstack/vue-query'
import { Project } from 'src/types/types';
import { dateMask, formatDate, parseDate } from 'src/services/dateFormating';

const name = ref('');
const run_name = ref('');
const dd_open = ref(false);
const selected_project: Ref<Project | null> = ref(null);
const file = ref<File | null>(null);


const { isLoading, isError, data, error } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: allProjects });
const dateTime: Ref<string> = ref(formatDate(new Date()));
const submitNewProject = async () => {
  const new_project = await createProject(name.value )
};

const submitNewRun = async () => {
  if (!selected_project.value || !file.value) {
    return;
  }
  const dateTimeConverted = parseDate(dateTime.value);
  const new_run = await createRun(run_name.value, selected_project.value.uuid, dateTimeConverted, file.value)
};
</script>

<style scoped>

</style>
