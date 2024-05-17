<template>
  <q-page class="flex">
    <div class="q-pa-md">
      <div class="text-h4">Run Analysis</div>
      <p>
        <i>Run analysis</i> allows you to perform automated analysis, tests and checks on a project or run level.
        Run analysis works similar to GitHub Actions or GitLab CI/CD pipelines. The analysis is performed in a docker
        container, which gets executed on the server. All you have to do is to specify the docker image, which contains
        the analysis code. The analysis code will be executed in the docker container, the results will be stored, and
        can be viewed via Webinterface.
      </p>

      <h3 class="text-h6">Submit new Run Analysis</h3>

      <!-- Select a project and run, on which the anylsis will be performed -->
      <q-form @submit.prevent="submitAnalysis">
        <div class="row items-center justify-between q-gutter-md">
          <div class="col-1">
            <q-btn-dropdown
              v-model="dropdownNewFileProject"
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
                  @click="selected_project = project; dropdownNewFileProject=false"
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
          <div class="col-1">
            <q-btn-dropdown
              v-model="dropdownNewFileRun"
              :label="selected_run?.name || 'Run'"
              outlined
              dense
              clearable
              required
            >
              <q-list>
                <q-item
                  v-for="run in runs"
                  :key="run.uuid"
                  clickable
                  @click="selected_run = run; dropdownNewFileRun=false"
                >
                  <q-item-section>
                    <q-item-label>
                      {{ run.name }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </div>
          <div class="col-5">
            <div class="row">
              <q-input v-model="image_name" outlined dense clearable label="Docker Image"
                       hint="e.g., rsleth/run-alys:latest"/>
            </div>
          </div>
          <div class="col-1">
            <q-btn
              label="Submit"
              color="primary"
              @click="submitAnalysis"/>
          </div>
        </div>
      </q-form>

      <template v-if="selected_project && selected_run">
        <RunAnalysis :project_uuid="selected_project?.uuid" :run_uuid="selected_run?.uuid"></RunAnalysis>
      </template>
      <template v-else>
        <q-card class="q-pa-sm q-ma-lg text-center">
          <div class="text">Please select a project and a run to...</div>
        </q-card>
      </template>
    </div>

  </q-page>
</template>

<script setup lang="ts">

import {Ref, ref, watchEffect} from 'vue';

import {Project, Run} from 'src/types/types';
import {useQuery} from '@tanstack/vue-query';
import {allProjects, runsOfProject} from 'src/services/queries';
import {Notify} from 'quasar';
import {createAnalysis} from 'src/services/mutations';
import RunAnalysis from 'components/RunAnalysis.vue';


const image_name = ref('');
const dropdownNewFileProject = ref(false);
const dropdownNewFileRun = ref(false);
const selected_project: Ref<Project | null> = ref(null);
const selected_run: Ref<Run | null> = ref(null);

const {data} = useQuery<Project[]>({queryKey: ['projects'], queryFn: allProjects});

const {data: runs, refetch} = useQuery(
  {
    queryKey: ['runs', selected_project.value?.uuid],
    queryFn: () => runsOfProject(selected_project.value?.uuid || ''),
    enabled: !!selected_project.value?.uuid,
  }
);

watchEffect(() => {
  if (selected_project.value?.uuid) {
    refetch();
  }
});

const submitAnalysis = () => {
  console.log(`Submit new analysis: ${selected_project.value?.uuid}, ${selected_run.value?.uuid}, ${image_name.value}`);

  // validate input (this will also be performed on the backend)
  // the user must select a project and a run
  // the image name must start with 'rslethz/'
  if (!selected_project.value || !selected_run.value) {
    Notify.create({
      group: false,
      message: 'Please select a project and a run',
      color: 'negative',
      position: 'top-right',
      timeout: 2000,
    });
    return;
  }

  if (!image_name.value.startsWith('rslethz/')) {
    Notify.create({
      group: false,
      message: 'The image name must start with "rslethz/"',
      color: 'negative',
      position: 'top-right',
      timeout: 2000,
    });
    return;
  }

  // post: the input should be valid now

  // send the analysis request to the backend and show a notification
  createAnalysis( image_name.value, selected_run.value.uuid,).then(
    () => {
      Notify.create({
        group: false,
        message: 'Analysis submitted',
        color: 'positive',
        position: 'top-right',
        timeout: 2000,
      });
    }
  ).catch(
    (error) => {
      Notify.create({
        group: false,
        message: `Error: ${error}`,
        color: 'negative',
        position: 'top-right',
        timeout: 2000,
      });
    });

};

</script>

