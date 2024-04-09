<template>
  <q-card-section>
    <h3 class="text-h6">Create new file</h3>
    <q-form @submit.prevent="submitNewFile">
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
            @click="submitNewFile"/>
        </div>
      </div>
    </q-form>

  </q-card-section>
</template>
<script setup lang="ts">
import { Ref, ref, watchEffect } from 'vue';
import { Notify } from 'quasar';
import { createDrive, createFile, createRun } from 'src/services/mutations';
import { Project, Run } from 'src/types/types';
import { useQuery } from '@tanstack/vue-query';
import { allProjects, runsOfProject } from 'src/services/queries';

const dropdownNewFileProject = ref(false);
const dropdownNewFileRun = ref(false);
const file = ref<File | null>(null);
const fileName = ref('');
const selected_project: Ref<Project | null> = ref(null);
const selected_run: Ref<Run | null> = ref(null);
const { isLoading, isError, data, error } = useQuery<Project[]>({ queryKey: ['projects'], queryFn: allProjects });

const drive_url = ref('');

const { data: runs, refetch } = useQuery(
  { queryKey: ['runs', selected_project.value?.uuid],
    queryFn: () => runsOfProject(selected_project.value?.uuid || ''),
    enabled: !!selected_project.value?.uuid,
}
);

watchEffect(() => {
  if (selected_project.value?.uuid) {
    refetch();
  }
});

const submitNewFile = async () => {
  if (!selected_run.value ) {
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
    await createFile(fileName.value, selected_run.value.uuid, file.value).then(
      (new_file) => {
        const end = new Date();
        noti({
          message: `File ${new_file.name} uploaded & processed in ${(end.getTime() - start.getTime()) / 1000} s`,
          color: 'positive',
          spinner: false,
          timeout: 5000,
        })
      }).catch((e) => {
      noti({
        message: `Upload of File ${fileName.value}failed: ${e}`,
        color: 'negative',
        spinner: false,
        timeout: 2000,
      })

    })
  }
  else if (drive_url.value) {
    console.log('Uploading from URL')
    await createDrive(fileName.value, selected_project.value.uuid, drive_url.value).then(
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
        message: `Upload of File ${fileName.value}failed: ${e}`,
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
