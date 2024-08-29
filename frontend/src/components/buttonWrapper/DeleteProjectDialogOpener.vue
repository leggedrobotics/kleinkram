<template>
    <div @click="deleteProject">
        <slot />
    </div>
</template>
<script setup lang="ts">
import { useQuasar } from 'quasar';
import DeleteProjectDialog from 'src/dialogs/DeleteProjectDialog.vue';

const { project_uuid } = defineProps({
    project_uuid: String,
});

const $q = useQuasar();

const deleteProject = () => {
    $q.dialog({
        title: 'Delete Project',
        component: DeleteProjectDialog,
        componentProps: {
            project_uuid,
        },
    });
};
</script>
