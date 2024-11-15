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
import { useQuasar } from 'quasar';
import {
    getPermissionForMission,
    getPermissionForProject,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed, ref, watchEffect } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import DeleteActionDialog from 'src/dialogs/DeleteActionDialog.vue';
import { Action } from 'src/types/Action';
import { getMe } from 'src/services/queries/user';

const $q = useQuasar();

const props = defineProps({
    action: Action,
});

const { data: permissions } = usePermissionsQuery();

const canDelete = computed(
    () => deletePermissions.value >= 30 || creatorDeleteRights.value,
);

const creatorDeleteRights = ref<boolean>(false);

watchEffect(async () => {
    const me = await getMe();

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
</script>
