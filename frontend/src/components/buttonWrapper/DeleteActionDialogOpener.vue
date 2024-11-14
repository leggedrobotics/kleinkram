<template>
    <div
        @click="openDeleteActionDialog"
        :class="{
            disabled: !canDelete,
            'cursor-pointer': !canDelete,
            'cursor-not-allowed': canDelete,
        }"
    >
        <slot />
        <q-tooltip v-if="!canDelete">
            You do not have permission to delete this action
        </q-tooltip>
    </div>
</template>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<script setup lang="ts">
import { Notify, useQuasar } from 'quasar';
import EditProjectDialog from 'src/dialogs/EditProjectDialog.vue';
import {
    canModifyProject,
    getPermissionForMission,
    getPermissionForProject,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed, ComputedRef, ref, watch, watchEffect } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { deleteAction } from 'src/services/mutations/action';
import DeleteActionDialog from 'src/dialogs/DeleteActionDialog.vue';
import { Action } from 'src/types/Action';
import { getMe } from 'src/services/queries/user';

const $q = useQuasar();
//not passed correctly yet in Action
const props = defineProps({
    action: Action,
});

const { data: permissions } = usePermissionsQuery();
// const me = await getMe();
const canDelete = computed(
    () => deletePermissions.value >= 30 || creatorDeleteRights.value,
    // canModifyProject(project_uuid, permissions.value),
);

const creatorDeleteRights = ref<boolean>(false);

watchEffect(async () => {
    const me = await getMe();
    // const creatorDeleteRights = computed(() => {
    const actionCreator = props.action?.createdBy;
    creatorDeleteRights.value = me.uuid === actionCreator?.uuid;
});

const deletePermissions = computed(() => {
    const projectPermissions = getPermissionForProject(
        props.action.mission?.project?.uuid,
        permissions.value,
    );
    const missionPermissions = getPermissionForMission(
        props.action.mission?.uuid,
        permissions.value,
    );

    const deletePermissions = Math.max(projectPermissions, missionPermissions);
    return deletePermissions;
});

const openDeleteActionDialog = () => {
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

const queryClient = useQueryClient();

//this will prob not be needed
// const { mutateAsync: deleteActionMutation } = useMutation({
//     mutationFn: (action: Action) => {
//         return deleteAction(action);
//     },
//     onSuccess: () => {
//         queryClient.invalidateQueries({
//             predicate: (query) => {
//                 //
//                 return query.queryKey[0] === 'action_mission';
//             },
//         });
//         Notify.create({
//             group: false,
//             message: 'Template created',
//             color: 'positive',
//             position: 'bottom',
//             timeout: 2000,
//         });
//     },
//     onError: (error) => {
//         console.error(error);
//         Notify.create({
//             group: false,
//             message: `Error: ${error?.response?.data.message}`,
//             color: 'negative',
//             position: 'bottom',
//             timeout: 2000,
//         });
//     },
// });
</script>
