<template>
    <base-dialog ref="dialogRef">
        <template #title> Change Access Rights</template>

        <template #content>
            <configure-access-rights
                v-model="modifiableAccessRights"
                :min-access-rights="minAccessRights"
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Confirm"
                class="bg-button-primary"
                @click="confirmAction"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import BaseDialog from './base-dialog.vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { getProjectAccess } from 'src/services/queries/access';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import {
    removeAccessGroupFromProject,
    updateProjectAccess,
} from 'src/services/mutations/access';
import { AccessGroupType } from '@common/enum';

import { ProjectAccessDto } from '@api/types/access-control/project-access.dto';
import { isAxiosError } from 'axios';
import ConfigureAccessRights from '@components/configure-access-rights/configure-access-rights.vue';
import { useProjectDefaultAccess } from '../hooks/query-hooks';
import { DefaultRightDto } from '@api/types/access-control/default-right.dto';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { data: defaultRights } = useProjectDefaultAccess();

const minAccessRights = computed<DefaultRightDto>(() =>
    defaultRights.value
        ? defaultRights.value.data.filter(
              (r) => r.type === AccessGroupType.PRIMARY,
          )
        : [],
);

const { project_uuid, project_access_uuid } = defineProps<{
    project_uuid: string;
    project_access_uuid: string;
}>();

const { data: projectAccess } = useQuery<ProjectAccessDto>({
    queryKey: ['projectAccess', project_access_uuid],
    queryFn: () => getProjectAccess(project_uuid, project_access_uuid),
});

const modifiableAccessRights = ref([]);
watch(
    projectAccess,
    () => {
        modifiableAccessRights.value = projectAccess.value?.data ?? [];
    },
    { immediate: true },
);

const queryClient = useQueryClient();
const { mutate: changeAccessRights } = useMutation({
    mutationFn: () =>
        Promise.all([
            ...modifiableAccessRights.value.map((a) =>
                updateProjectAccess(project_uuid, a.uuid, a.rights),
            ),
            ...projectAccess.value?.data
                .filter((a) => !modifiableAccessRights.value.includes(a))
                .map((a) => removeAccessGroupFromProject(project_uuid, a.uuid)),
        ]),

    onSuccess: async () => {
        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'projectAccess',
        });
        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'AccessGroup',
        });
    },
    onError: (error: unknown) => {
        let errorMessage = 'An unknown error occurred';

        if (isAxiosError(error)) {
            errorMessage =
                error.response?.data?.message ?? 'No error message provided';
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }

        Notify.create({
            message: `Failed to change access rights:  ${errorMessage}`,
            color: 'negative',
            position: 'bottom',
        });
    },
});

function confirmAction(): void {
    changeAccessRights();
    onDialogOK();
}
</script>

<style scoped></style>
