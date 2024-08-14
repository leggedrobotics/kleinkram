<template>
    <div @click="editProjectDialog">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import CreateFileDialog from 'src/dialogs/CreateFileDialog.vue';
import EditProjectDialog from 'src/dialogs/EditProjectDialog.vue';

const $q = useQuasar();

const { project_uuid } = defineProps({
    project_uuid: String,
});

const editProjectDialog = () =>
    $q.dialog({
        component: EditProjectDialog,
        componentProps: {
            project_uuid: project_uuid,
        },
    });
</script>
