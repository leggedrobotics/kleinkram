<template>
    <div
        @click="canDelete ? _removeProject : null"
        :class="{
            disabled: !canDelete,
            'cursor-pointer': !canDelete,
            'cursor-not-allowed': canDelete,
        }"
    >
        <slot />

        <q-tooltip v-if="!canDelete">
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
import ROLE from 'src/enums/USER_ROLES';
import {
    canDeleteProject,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';

const $q = useQuasar();
const props = defineProps<{
    accessGroup: AccessGroup;
    projectUUID: string;
}>();

const { data: permissions } = usePermissionsQuery();
const canDelete = computed(() =>
    canDeleteProject(props.projectUUID, permissions.value),
);
const queryClient = useQueryClient();

const { mutate: _removeProject } = useMutation({
    mutationFn: () =>
        removeAccessGroupFromProject(props.projectUUID, uuid.value),
    onSuccess: () => {
        queryClient.invalidateQueries({
            queryKey: ['AccessGroup', uuid],
        });
        Notify.create({
            message: 'Project removed from access group',
            color: 'positive',
            position: 'bottom',
        });
    },
    onError: () => {
        Notify.create({
            message: 'Error removing project from access group',
            color: 'negative',
            position: 'bottom',
        });
    },
});
</script>

<style scoped></style>
