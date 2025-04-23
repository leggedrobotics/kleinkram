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
import { canDeleteProject, usePermissionsQuery } from '@hooks/query-hooks';
import { AccessGroupDto } from '@api/types/user.dto';

const { accessGroup, projectUUID } = defineProps<{
    accessGroup: AccessGroupDto;
    projectUUID: string;
}>();

const { data: permissions } = usePermissionsQuery();
const canDelete = computed(() =>
    canDeleteProject(projectUUID, permissions.value),
);
const queryClient = useQueryClient();

const removeProject = (): void => {
    if (!canDelete.value) return;
    _removeProject();
};

const { mutate: _removeProject } = useMutation({
    mutationFn: () =>
        removeAccessGroupFromProject(projectUUID, accessGroup.uuid),
    onSuccess: async () => {
        await queryClient.invalidateQueries({
            queryKey: ['AccessGroup', accessGroup.uuid],
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
