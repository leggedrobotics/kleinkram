<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete Project</template>
        <template #content>
            <DeleteProject :project="project" @deleted="onDialogCancel" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Delete Project"
                class="bg-button-primary"
                @click="onDialogCancel"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import DeleteProject from 'components/DeleteProject.vue';
import { Project } from 'src/types/Project';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const { dialogRef, onDialogCancel } = useDialogPluginComponent();

defineProps<{
    project: Project;
}>();
</script>
