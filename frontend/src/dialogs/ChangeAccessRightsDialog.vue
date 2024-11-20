<template>
    <base-dialog ref="dialogRef">
        <template #title>Change Access Rights</template>

        <template #content>
            <q-form @submit="onDialogOK" class="row flex">
                <b style="align-content: center" v-if="projectAccess">{{
                    projectAccess.project?.name
                }}</b>
                <q-select
                    v-model="rights"
                    :options="options"
                    label="Select Access Rights"
                    style="width: 50%; margin-left: 20%"
                    v-if="projectAccess"
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
import { ProjectAccess } from 'src/types/ProjectAccess';
import { ref, watch } from 'vue';
import { updateProjectAccess } from 'src/services/mutations/access';
import { AccessGroupRights } from '@common/enum';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    project_uuid: string;
    project_access_uuid: string;
}>();

const rights = ref({ label: 'None', value: AccessGroupRights.READ });
const queryClient = useQueryClient();

const { data: projectAccess } = useQuery<ProjectAccess>({
    queryKey: ['projectAccess', props.project_access_uuid],
    queryFn: () =>
        getProjectAccess(props.project_uuid, props.project_access_uuid),
});

const { mutate: changeAccessRights } = useMutation({
    mutationFn: () => {
        return updateProjectAccess(
            props.project_uuid,
            projectAccess.value?.accessGroup.uuid,
            rights.value.value,
        );
    },
    onSuccess: () => {
        queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'projectAccess',
        });
        queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'AccessGroup',
        });
    },
    onError: (e) => {
        Notify.create({
            message: `Failed to change access rights:  ${e.response?.data.message}`,
            color: 'negative',
            position: 'bottom',
        });
    },
});
watch(
    projectAccess,
    () => {
        rights.value = {
            label: accessGroupRightsMap[projectAccess.value?.rights || 0],
            value: projectAccess.value?.rights || 0,
        };
    },
    {
        immediate: true,
    },
);

const options = Object.keys(accessGroupRightsMap)
    .map((key) => ({
        label: accessGroupRightsMap[parseInt(key, 10) as AccessGroupRights],
        value: parseInt(key, 10),
    }))
    .filter((option) => option.value !== AccessGroupRights.READ);

function confirmAction() {
    changeAccessRights();
    onDialogOK();
}
</script>

<style scoped></style>
