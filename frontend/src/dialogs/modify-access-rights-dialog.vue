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
import ConfigureAccessRights from 'components/configure-access-rights/configure-access-rights.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useUpdateAccessRightsMutation } from 'src/hooks/mutation-hooks';
import {
    useMinimalAccessRightsForNewProject,
    useProjectAccessRights,
} from 'src/hooks/query-hooks';
import { useEditablePaginatedResponse } from 'src/hooks/utility-hooks';
import { unref, watch } from 'vue';

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
