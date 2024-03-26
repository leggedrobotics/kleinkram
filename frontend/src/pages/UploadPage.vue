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
          <div class="col-1">
            <div class="row" style="padding-bottom: 8px">
              <q-file outlined v-model="file" hint="Upload File">
                <template v-slot:prepend>
                  <q-icon name="attach_file" />
                </template>
                <template v-slot:append>
                  <q-icon name="cancel" @click="file=null"/>
                </template>
              </q-file>
            </div>
            <div class="row">
              <q-input v-model="drive_url" outlined dense clearable hint="Google Drive URL"/>
            </div>
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
import { createDrive, createProject, createRun } from 'src/services/mutations';
import { allProjects } from 'src/services/queries';
import { useQuery } from '@tanstack/vue-query'
import { Project } from 'src/types/types';
import { dateMask, formatDate, parseDate } from 'src/services/dateFormating';
import { Notify } from 'quasar'
const name = ref('');
const run_name = ref('');
const dd_open = ref(false);
const selected_project: Ref<Project | null> = ref(null);
const file = ref<File | null>(null);
const drive_url = ref('');

const { isLoading, isError, data, error } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: allProjects });
const submitNewProject = async () => {
  const new_project = await createProject(name.value )
};

const submitNewRun = async () => {
  if (!selected_project.value ) {
    return;
  }
  const noti = Notify.create({
    group: false,
    message: 'Processing file...',
    color: 'primary',
    spinner: true,
    position: 'top-right',
    timeout: 0,
  })
  const start = new Date();
  if (file.value) {
    await createRun(run_name.value, selected_project.value.uuid, file.value).then(
      (new_run) => {
        const end = new Date();
        noti({
          message: `File ${new_run.name} uploaded & processed in ${(end.getTime() - start.getTime()) / 1000} s`,
          color: 'positive',
          spinner: false,
          timeout: 5000,
        })
      }).catch((e) => {
      noti({
        message: `Upload of File ${run_name.value}failed: ${e}`,
        color: 'negative',
        spinner: false,
        timeout: 2000,
      })

    })
  }
  else if (drive_url.value) {
    console.log('Uploading from URL')
    await createDrive(run_name.value, selected_project.value.uuid, drive_url.value).then(
      (new_run) => {
        const end = new Date();
        noti({
          message: `File ${new_run.name} loaded & processed in ${(end.getTime() - start.getTime()) / 1000} s`,
          color: 'positive',
          spinner: false,
          timeout: 5000,
        })
      }).catch((e) => {
      noti({
        message: `Upload of File ${run_name.value}failed: ${e}`,
        color: 'negative',
        spinner: false,
        timeout: 0,
        closeBtn: true,
      })

    })
  }
  else {
    noti({
      message: 'No file or URL provided',
      color: 'negative',
      spinner: false,
      timeout: 2000,
    })
  }
  console.log('completed')
};
</script>

<style scoped>

</style>
