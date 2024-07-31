<template>
  <q-dialog ref="dialogRef">
    <q-card
        class="q-pa-sm text-center"
        style="width: 80%; min-height: 250px; max-width: 1500px"
    >
      <create-mission :project="props.project"/>
      <div class="q-mt-md row">
        <div class="col-10"/>
        <div class="col-2">
          <q-btn label="OK" color="primary" @click="onDialogOK"/>
        </div>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import {useDialogPluginComponent} from 'quasar';
import CreateMission from 'components/CreateMission.vue';
import {useQuery} from "@tanstack/vue-query";
import {getProject} from "src/services/queries/project";
import {watch} from "vue";

const {dialogRef, onDialogOK} = useDialogPluginComponent();

const props = defineProps<{
  project_uuid?: string;
}>();

const {data: project, refetch} = useQuery({
  queryKey: ['project', props.project_uuid],
  queryFn: () => !!props.project_uuid ? getProject(props.project_uuid) : undefined,
  enabled: !!props.project_uuid
})

watch(project, () => {
  if (project.value) {
    refetch()
  }
})


</script>

<style scoped></style>
