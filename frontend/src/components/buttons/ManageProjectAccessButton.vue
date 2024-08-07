<template>
    <q-btn
        color="primary"
        outline
        icon="sym_o_lock"
        label="Access Rights"
        @click="manageProjectAccess"
    >
        <q-tooltip> Manage Access to the Project </q-tooltip>
    </q-btn>
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
