<template>
    <div
        v-if="canModify"
        class="cursor-pointer"
        style="height: 100%"
        @click="clicked"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import ModifyProjectMetadataTypesDialog from 'src/dialogs/modify-project-metadata-types-dialog.vue';
import { canModifyProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const $q = useQuasar();
const { projectUuid } = defineProps<{ projectUuid: string }>();

const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyProject(projectUuid, permissions.value),
);

const clicked = (): void => {
    // abort if the user cannot modify the project
    if (!canModify.value) return;

    // open the dialog
    $q.dialog({
        component: ModifyProjectMetadataTypesDialog,
        componentProps: {
            projectUUID: projectUuid,
        },
    });
};
</script>
