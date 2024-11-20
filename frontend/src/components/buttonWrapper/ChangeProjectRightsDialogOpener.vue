<template>
    <div
        @click="changeRights"
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
    >
        <slot />

        <q-tooltip v-if="!canModify">
            You need delete rights on the project to remove it from this access
            group
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
import { computed, Ref, ref } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import {
    deleteAccessGroup,
    removeAccessGroupFromProject,
} from 'src/services/mutations/access';
import { AccessGroup } from 'src/types/AccessGroup';
import { getUser } from 'src/services/auth';
import { User } from 'src/types/User';
import {
    canDeleteProject,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import ChangeAccessRightsDialog from 'src/dialogs/ChangeAccessRightsDialog.vue';

const $q = useQuasar();
const props = defineProps<{
    projectAccessUUID: string;
    projectUUID: string;
}>();

const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canDeleteProject(props.projectUUID, permissions.value),
);
const queryClient = useQueryClient();

function changeRights() {
    if (!canModify.value) {
        return;
    }
    $q.dialog({
        component: ChangeAccessRightsDialog,
        componentProps: {
            project_uuid: props.projectUUID,
            project_access_uuid: props.projectAccessUUID,
        },
    });
}
</script>

<style scoped></style>
