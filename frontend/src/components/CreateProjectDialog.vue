<template>
  <q-dialog ref="dialogRef" persistent style="max-width: 1500px">
    <q-card class="q-pa-sm text-center" style="width: 80%; min-height: 300px; max-width: 1500px">
      <create-project/>
      <div class="q-mt-md row">
        <div class="col-10"/>
        <div class="col-2">
          <q-btn
            label="OK"
            color="primary"
            @click="onDialogOK"
          />
        </div>

      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import {useDialogPluginComponent} from 'quasar';
import CreateProject from 'components/CreateProject.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent()

</script>

<style scoped>

</style>
