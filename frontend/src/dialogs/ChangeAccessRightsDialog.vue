<template>
    <base-dialog ref="dialogRef">
        <template #title> Change Access Rights</template>

        <template #content>
            <q-form class="row flex" @submit="onDialogOK">
                <b v-if="projectAccess" style="align-content: center">{{
                    // @ts-ignore
                    projectAccess.project?.name
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
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { accessGroupRightsMap } from 'src/services/generic';
import { getProjectAccess } from 'src/services/queries/access';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ref, watch } from 'vue';
import { updateProjectAccess } from 'src/services/mutations/access';
import { AccessGroupRights } from '@common/enum';
import { ProjectAccessDto } from '@api/types/Project.dto';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const properties = defineProps<{
    project_uuid: string;
    project_access_uuid: string;
}>();

const rights = ref({ label: 'None', value: AccessGroupRights.READ });
const queryClient = useQueryClient();

const { data: projectAccess } = useQuery<ProjectAccessDto>({
    queryKey: ['projectAccess', properties.project_access_uuid],
    queryFn: () =>
        getProjectAccess(
            properties.project_uuid,
            properties.project_access_uuid,
        ),
});

const { mutate: changeAccessRights } = useMutation({
    mutationFn: () => {
        return updateProjectAccess(
            properties.project_uuid,
            // @ts-ignore
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
    onError: (e: unknown) => {
        let errorMessage = '';
        if (e instanceof Error) {
            // @ts-ignore
            errorMessage = e.response?.data.message;
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
            // @ts-ignore
            label: accessGroupRightsMap[projectAccess.value?.rights || 0],
            // @ts-ignore
            value: projectAccess.value?.rights || 0,
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    .filter((option) => option.value !== AccessGroupRights.READ);

function confirmAction() {
    changeAccessRights();
    onDialogOK();
}
</script>

<style scoped></style>
