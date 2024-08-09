<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-xl text-center"
            style="width: 80%; min-height: 250px; max-width: 1500px"
        >
            <EditProject :project_uuid="project_uuid" />
        </q-card>
    </q-dialog>
</template>
<script setup lang="ts">
import EditProject from 'components/EditProject.vue';
import { useDialogPluginComponent } from 'quasar';
const { dialogRef } = useDialogPluginComponent();

const props = defineProps<{
    project_uuid: string;
}>();
</script>
<style scoped></style>
