<template>
    <q-dialog ref="dialogRef" persistent style="max-width: 1500px">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 1500px"
        >
            <create-file :run="props.run" />
            <div class="q-mt-md row">
                <div class="col-10" />
                <div class="col-2">
                    <q-btn label="OK" color="primary" @click="onDialogOK" />
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import { Run } from 'src/types/types';
import CreateFile from 'components/CreateFile.vue';
const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    run?: Run;
}>();
</script>

<style scoped></style>
