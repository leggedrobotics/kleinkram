
<template>
  <q-dialog ref="dialogRef" persistent style="max-width: 1500px">
    <q-card class="q-pa-sm text-center" style="width: 80%; min-height: 200px; max-width: 500px">
      <h5>
        Move run {{run.name}} to another project
      </h5>
      <div class="row q-gutter-sm">
        <div class="col-7 col-md-7">
          <q-btn-dropdown
            v-model="dd_open"
            outlined
            dense
            class="full-width"
            :label="selected_project?.name || 'Project'"
          >
            <q-list
              >
              <q-item
                v-for="project in projects"
                :key="project.uuid"
                clickable
                @click="selected_project = project; dd_open=false"
              >
                <q-item-section>
                  <q-item-label>{{ project.name }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </div>
        <div class="col-2">
          <q-btn
            label="OK"
            color="primary"
            @click="onOk"
            style="margin-right: 5px"
          />
        </div>
        <div class="col-1">
          <q-btn
            label="Cancel"
            color="secondary"
            @click="onDialogOK"
          />
        </div>
      </div>
    </q-card>
  </q-dialog>
</template>
<script setup lang="ts">
import {useQuery, useQueryClient} from '@tanstack/vue-query';
import {Project, Run} from 'src/types/types';
import {allProjects} from 'src/services/queries';
import {ref} from 'vue';
import {useDialogPluginComponent} from 'quasar';
import {moveRun} from 'src/services/mutations';

const { dialogRef, onDialogOK } = useDialogPluginComponent()

const props = defineProps<{
  run?: Run;
}>();

const queryClient = useQueryClient();

const projectsReturn = useQuery<Project[]>(
  { queryKey: ['projects'],
    queryFn: allProjects
  }
);
const projects = projectsReturn.data || [];

const selected_project = ref<Project | null>(props.run?.project || null);

const dd_open = ref(false);

async function onOk() {
  if (!props.run || !selected_project.value) {
    return;
  }
  try {
    await moveRun(props.run.uuid, selected_project.value.uuid,);
    const cache = queryClient.getQueryCache();
    const filtered = cache.getAll().filter((query) => (query.queryKey[0] === 'runs' || query.queryKey[0] === 'projects') );
    filtered.forEach((query) => {
      queryClient.invalidateQueries(query.queryKey);
    });
  }
  catch (e){
    console.error(e);
  }
  onDialogOK()
}

</script>

<style scoped>

</style>
