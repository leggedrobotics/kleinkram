<template>
    <q-dialog ref="dialogRef" persistent style="max-width: 1500px">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 1500px"
        >
            <create-mission :project="props.project" />
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
import CreateMission from 'components/CreateMission.vue';
import { Project } from 'src/types/types';
const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    project?: Project;
}>();
</script>

<style scoped></style>
