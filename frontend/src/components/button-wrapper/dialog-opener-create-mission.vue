<template>
    <div
        v-if="canCreate"
        class="cursor-pointer"
        style="height: 100%"
        @click="createNewMission"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
import { AccessGroupRights } from '@kleinkram/shared';
import { useQuasar } from 'quasar';
import CreateMissionDialog from 'src/dialogs/create-mission-dialog.vue';
import {
    canCreateMission,
    hasProjectRightsAnywhere,
    usePermissionsQuery,
} from 'src/hooks/query-hooks';
import { computed, inject } from 'vue';

const { projectUuid } = defineProps<{ projectUuid?: string | undefined }>();

const $q = useQuasar();

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const uploads = inject('uploads')!;

const { data: permissions } = usePermissionsQuery();
const canCreate = computed(() => {
    // Without a project the dialog lets the user pick one, so CREATE on any
    // project is enough to show the entry point.
    if (!projectUuid) {
        return hasProjectRightsAnywhere(
            AccessGroupRights.CREATE,
            permissions.value,
        );
    }
    return canCreateMission(projectUuid, permissions.value);
});

const createNewMission = (): void => {
    if (!canCreate.value) return;
    $q.dialog({
        title: 'Create new mission',
        component: CreateMissionDialog,
        componentProps: {
            projectUuid: projectUuid,
            uploads,
        },
    });
};
</script>
