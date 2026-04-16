<template>
    <base-dialog ref="dialogRef">
        <template #title>Change Access Rights</template>

        <template #content>
            <access-rights-manager
                v-model="modifiableAccessRights"
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
import AccessRightsManager from 'components/configure-access-rights/access-rights-manager.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useUpdateAccessRightsMutation } from 'src/hooks/mutation-hooks';
import {
    useProjectAccessRights,
} from 'src/hooks/query-hooks';
import { useEditablePaginatedResponse } from 'src/hooks/utility-hooks';

const { projectUuid: projectUuid } = defineProps<{ projectUuid: string }>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();


const { data: projectAccess } = useProjectAccessRights(projectUuid);
const modifiableAccessRights = useEditablePaginatedResponse(projectAccess);

const { mutate: changeAccessRights } = useUpdateAccessRightsMutation(
    projectUuid,
    modifiableAccessRights,
);

const confirmAccessRightsModification: () => void = () => {
    changeAccessRights();
    onDialogOK();
};
</script>
