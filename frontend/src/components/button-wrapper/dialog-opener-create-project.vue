<template>
    <div
        v-if="canCreate"
        class="cursor-pointer"
        style="height: 100%"
        @click="createNewProject"
    >
        <slot />
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
