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
} from 'src/hooks/customQueryHooks';
import { computed, ref, watchEffect } from 'vue';
import DeleteActionDialog from 'src/dialogs/DeleteActionDialog.vue';
import { getMe } from 'src/services/queries/user';
import { ActionState } from '@common/enum';
import { ActionDto } from '@api/types/Actions.dto';

const $q = useQuasar();

const props = defineProps({
    action: ActionDto,
});

const { data: permissions } = usePermissionsQuery();

const canDelete = computed(
    () =>
        actionInDeletableState.value &&
        (deletePermissions.value >= 30 || isCreator.value),
);

const actionInDeletableState = computed(() => {
    const state = props.action?.state;
    return (
        state === ActionState.FAILED ||
        state === ActionState.DONE ||
        state === ActionState.UNPROCESSABLE
    );
});

const isCreator = ref<boolean>(false);

watchEffect(() => {
    getMe()
        .then((me) => {
            const actionCreator = props.action?.creator;
            isCreator.value = me.uuid === actionCreator?.uuid;
        })
        .catch((e: unknown) => {
            console.error(e);
        });
});

const deletePermissions = computed(() => {
    const projectPermissions = getPermissionForProject(
        props.action?.mission.project.uuid,
        permissions.value,
    );
    const missionPermissions = getPermissionForMission(
        props.action?.mission.uuid,
        permissions.value,
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
            action: props.action,
        },
    });
};
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
