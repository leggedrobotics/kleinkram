<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 500px"
        >
            <DeleteProject :project="project" @deleted="onDialogCancel" />
        </q-card>
    </q-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import DeleteProject from 'components/DeleteProject.vue';
import { Project } from 'src/types/Project';

const { dialogRef, onDialogCancel } = useDialogPluginComponent();

defineProps<{
    project: Project;
}>();
</script>
