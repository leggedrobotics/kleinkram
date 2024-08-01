<template>
  <q-dialog ref="dialogRef">
    <q-card
        class="q-pa-sm text-center"
        style="width: 80%; min-height: 250px; max-width: 1500px"
    >
      <create-mission :project="project" v-if="isFetched" />
      <div class="q-mt-md row">
        <div class="col-10"/>
        <div class="col-2">
          <q-btn label="OK" color="primary" @click="onDialogCancel"/>
        </div>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import {useDialogPluginComponent} from 'quasar';
import CreateMission from 'components/CreateMission.vue';
import {useProjectQuery} from "src/hooks/customQueryHooks";
import {ref, watch} from "vue";

const {dialogRef, onDialogCancel} = useDialogPluginComponent();

const {project_uuid} = defineProps<{ project_uuid: string }>()
console.log(project_uuid)
const {data: project, isFetched} = useProjectQuery(ref(project_uuid));

watch([project, isFetched], () => {
  console.log(project)
  console.log(isFetched)
})

</script>

<style scoped></style>
