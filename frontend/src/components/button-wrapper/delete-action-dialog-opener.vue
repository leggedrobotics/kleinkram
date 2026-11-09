<template>
    <div
        v-if="hasPermission"
        :class="
            actionInDeletableState
                ? 'cursor-pointer'
                : 'disabled cursor-not-allowed'
        "
        @click="openDeleteActionDialog"
    >
        <slot />
        <q-tooltip v-if="!actionInDeletableState">
            You can only delete actions if they're DONE, FAILED, UNPROCESSABLE
            or CANCELLED
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { AccessGroupRights, isTerminalActionState } from '@kleinkram/shared';
import { useQuasar } from 'quasar';
import DeleteActionDialog from 'src/dialogs/delete-action-dialog.vue';
import {
    getPermissionForMission,
    getPermissionForProject,
    usePermissionsQuery,
    useUser,
} from 'src/hooks/query-hooks';
import { computed } from 'vue';

import type { ActionDto } from '@kleinkram/api-dto/types/actions/action.dto';

const $q = useQuasar();

const { action } = defineProps<{ action: ActionDto }>();

const { data: permissions } = usePermissionsQuery();

const hasPermission = computed(
    () =>
        deletePermissions.value >= AccessGroupRights.DELETE || isCreator.value,
);

const actionInDeletableState = computed(() =>
    isTerminalActionState(action.state),
);

const { data: user } = useUser();
const isCreator = computed(() => action.creator.uuid === user.value?.uuid);

const deletePermissions = computed((): AccessGroupRights => {
    const projectPermissions = getPermissionForProject(
        action.mission.project.uuid,
        permissions.value ?? undefined,
    );
    const missionPermissions = getPermissionForMission(
        action.mission.uuid,
        permissions.value ?? undefined,
    );

    return Math.max(projectPermissions, missionPermissions);
});

const openDeleteActionDialog = (): void => {
    // abort if the user cannot modify the project
    if (!hasPermission.value || !actionInDeletableState.value) return;

    // open the dialog
    $q.dialog({
        component: DeleteActionDialog,
        componentProps: {
            action: action,
        },
    });
};
</script>
