<template>
    <div @click="manageProjectAccess">
        <slot />
    </div>
</template>

<script setup lang="ts">
import AccessRightsDialog from 'src/dialogs/AccessRightsDialog.vue';
import { useQuasar } from 'quasar';

const { project_uuid } = defineProps({
    project_uuid: String,
});

const $q = useQuasar();
const manageProjectAccess = () =>
    $q.dialog({
        title: 'Manage Access',
        component: AccessRightsDialog,
        componentProps: {
            project_uuid: project_uuid,
        },
    });
</script>
