<template>
    <div
        :class="{
            disabled: !canDelete,
            'cursor-pointer': !canDelete,
            'cursor-not-allowed': canDelete,
        }"
        @click="openDeleteActionDialog"
    >
        <slot />
        <q-tooltip v-if="!canDelete && !actionInDeletableState">
            You can only delete actions if they're DONE, FAILED or UNPROCESSABLE
        </q-tooltip>
        <q-tooltip v-else-if="!canDelete">
            You do not have permission to delete this action
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import {
    getPermissionForMission,
    getPermissionForProject,
    usePermissionsQuery,
    useUser,
} from '../../hooks/query-hooks';
import { computed } from 'vue';
import DeleteActionDialog from '../../dialogs/delete-action-dialog.vue';
import { ActionState } from '@common/enum';

import { ActionDto } from '@api/types/actions/action.dto';

const $q = useQuasar();

const { action } = defineProps<{ action: ActionDto }>();

const { data: permissions } = usePermissionsQuery();

const canDelete = computed(
    () =>
        actionInDeletableState.value &&
        (deletePermissions.value >= 30 || isCreator.value),
);

const actionInDeletableState = computed(() => {
    const state = action.state;
    return (
        state === ActionState.FAILED ||
        state === ActionState.DONE ||
        state === ActionState.UNPROCESSABLE
    );
});

const { data: user } = useUser();
const isCreator = computed(() => action.creator.uuid === user.value?.uuid);

const deletePermissions = computed(() => {
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
    if (!canDelete.value) return;

    // open the dialog
    $q.dialog({
        component: DeleteActionDialog,
        componentProps: {
            action: action,
        },
    });
};
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
