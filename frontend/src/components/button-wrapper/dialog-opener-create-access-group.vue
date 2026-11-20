<template>
    <app-create-button
        v-if="canCreate"
        label="Create Access Group"
        @click="createAccessGroupDialog"
    />
</template>

<script setup lang="ts">
import AppCreateButton from 'components/common/app-create-button.vue';
import { useQuasar } from 'quasar';
import CreateAccessGroupDialog from 'src/dialogs/create-access-group-dialog.vue';
import { canCreateProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const { data: permissions } = usePermissionsQuery();
const canCreate = computed(() => canCreateProject(permissions.value));

const $q = useQuasar();

// the dialog creates the group itself, so it can show a taken name inline
const createAccessGroupDialog = (): void => {
    $q.dialog({ component: CreateAccessGroupDialog });
};
</script>
