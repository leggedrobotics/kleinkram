<template>
    <div
        :class="{
            disabled: !canDelete,
            'cursor-pointer': !canDelete,
            'cursor-not-allowed': canDelete,
        }"
        @click="removeProject"
    >
        <slot />

        <q-tooltip v-if="!canDelete">
            You need delete rights on the project to remove it from this access
            group
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { Notify } from 'quasar';
import { computed } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { removeAccessGroupFromProject } from 'src/services/mutations/access';
import { AccessGroup } from 'src/types/AccessGroup';
import {
    canDeleteProject,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';

const props = defineProps<{
    accessGroup: AccessGroup;
    projectUUID: string;
}>();

const { data: permissions } = usePermissionsQuery();
const canDelete = computed(() =>
    canDeleteProject(props.projectUUID, permissions.value),
);
const queryClient = useQueryClient();

function removeProject() {
    if (!canDelete.value) return;
    _removeProject();
}

const { mutate: _removeProject } = useMutation({
    mutationFn: () =>
        removeAccessGroupFromProject(props.projectUUID, props.accessGroup.uuid),
    onSuccess: async () => {
        await queryClient.invalidateQueries({
            queryKey: ['AccessGroup', props.accessGroup.uuid],
        });
        Notify.create({
            message: 'Project removed from access group',
            color: 'positive',
            position: 'bottom',
        });
    },
    onError: () => {
        Notify.create({
            message: `Error removing project from access group.`,
            color: 'negative',
            position: 'bottom',
        });
    },
});
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<style scoped></style>
