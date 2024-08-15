<template>
    <div @click="deleteProject">
        <slot />
    </div>
</template>
<script setup lang="ts">
import { useQuasar } from 'quasar';
import { Project } from 'src/types/Project';
import DeleteProjectDialog from 'src/dialogs/DeleteProjectDialog.vue';

const { project } = defineProps({
    project: Project,
});

const $q = useQuasar();

const deleteProject = () =>
    $q.dialog({
        title: 'Delete Project',
        component: DeleteProjectDialog,
        componentProps: {
            project,
        },
    });
</script>
