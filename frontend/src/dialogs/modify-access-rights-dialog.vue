<template>
    <base-dialog ref="dialogRef">
        <template #title> Change Access Rights</template>

        <template #content>
            <q-form class="row flex" @submit="onDialogOK">
                <b v-if="projectAccess" style="align-content: center">{{
                    projectAccess.name
                }}</b>
                <q-select
                    v-if="projectAccess"
                    v-model="rights"
                    :options="options"
                    label="Select Access Rights"
                    style="width: 50%; margin-left: 20%"
                />
            </q-form>
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
import { accessGroupRightsMap } from 'src/services/generic';
import { getProjectAccess } from 'src/services/queries/access';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { Ref, ref, watch } from 'vue';
import { updateProjectAccess } from 'src/services/mutations/access';
import { AccessGroupRights } from '@common/enum';

import { ProjectAccessDto } from '@api/types/access-control/project-access.dto';
import { isAxiosError } from 'axios';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { project_uuid, project_access_uuid } = defineProps<{
    project_uuid: string;
    project_access_uuid: string;
}>();

const rights = ref({ label: 'None', value: AccessGroupRights.READ });
const queryClient = useQueryClient();

const { data: projectAccess } = useQuery<ProjectAccessDto>({
    queryKey: ['projectAccess', project_access_uuid],
    queryFn: () => getProjectAccess(project_uuid, project_access_uuid),
});

console.log(projectAccess.value);

const { mutate: changeAccessRights } = useMutation({
    mutationFn: () => {
        return updateProjectAccess(
            project_uuid,
            projectAccess.value?.accessGroup.uuid,
            rights.value.value,
        );
    },
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
watch(
    projectAccess,
    () => {
        rights.value = {
            label: accessGroupRightsMap[
                projectAccess.value?.rights ?? AccessGroupRights.READ
            ],
            value: projectAccess.value?.rights ?? AccessGroupRights.READ,
        };
    },
    {
        immediate: true,
    },
);

const options = Object.keys(accessGroupRightsMap)
    .map((key) => ({
        label: accessGroupRightsMap[
            Number.parseInt(key, 10) as AccessGroupRights
        ],
        value: Number.parseInt(key, 10),
    }))

    .filter(
        (option: Ref<AccessGroupRights>) =>
            option.value !== AccessGroupRights.READ,
    );

function confirmAction(): void {
    changeAccessRights();
    onDialogOK();
}
</script>

<style scoped></style>
