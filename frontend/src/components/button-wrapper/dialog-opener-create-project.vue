<template>
    <div
        :class="{
            disabled: !canCreate,
            'cursor-pointer': !canCreate,
            'cursor-not-allowed': canCreate,
        }"
        @click="createNewProject"
    >
        <slot />
        <q-tooltip v-if="!canCreate">
            You do not have permission to create a new project
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import CreateProjectDialog from 'src/dialogs/create-project-dialog.vue';
import { canCreateProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const { data: permissions } = usePermissionsQuery();
const canCreate = computed(() => canCreateProject(permissions.value));

const $q = useQuasar();
const createNewProject = (): void => {
    // abort if the user cannot modify the project
    if (!canCreate.value) return;

    // open the dialog
    $q.dialog({
        title: 'Create new project',
        component: CreateProjectDialog,
    });
};
</script>
