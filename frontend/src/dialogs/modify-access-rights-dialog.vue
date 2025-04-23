<template>
    <base-dialog ref="dialogRef">
        <template #title>Change Access Rights</template>

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
                @click="confirmAccessRightsModification"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import BaseDialog from './base-dialog.vue';
import { useDialogPluginComponent } from 'quasar';
import { unref, watch } from 'vue';
import ConfigureAccessRights from '@components/configure-access-rights/configure-access-rights.vue';
import {
    useMinimalAccessRightsForNewProject,
    useProjectAccessRights,
} from '../hooks/query-hooks';
import { useUpdateAccessRightsMutation } from '../hooks/mutation-hooks';
import { useEditablePaginatedResponse } from '../hooks/utility-hooks';

const { projectUuid: projectUuid } = defineProps<{ projectUuid: string }>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const minAccessRights = useMinimalAccessRightsForNewProject();
const { data: projectAccess } = useProjectAccessRights(projectUuid);
const modifiableAccessRights = useEditablePaginatedResponse(projectAccess);

// debug watch
watch(modifiableAccessRights, () => {
    console.debug(
        `project access rights for project ${projectUuid} got modified to:
${JSON.stringify(unref(modifiableAccessRights), null, 2)}`,
    );
});

const { mutate: changeAccessRights } = useUpdateAccessRightsMutation(
    projectUuid,
    modifiableAccessRights,
);

const confirmAccessRightsModification: () => void = () => {
    changeAccessRights();
    onDialogOK();
};
</script>
