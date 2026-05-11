<template>
    <base-dialog ref="dialogRef">
        <template #title>Change Access Rights</template>

        <template #content>
            <access-rights-manager v-model="modifiableAccessRights" />
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
import { AccessGroupRights, UserRole } from '@kleinkram/shared';
import AccessRightsManager from 'components/configure-access-rights/access-rights-manager.vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useUpdateAccessRightsMutation } from 'src/hooks/mutation-hooks';
import { useProjectAccessRights, useUser } from 'src/hooks/query-hooks';
import { useEditablePaginatedResponse } from 'src/hooks/utility-hooks';

const { projectUuid: projectUuid } = defineProps<{ projectUuid: string }>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const $q = useQuasar();

const { data: user } = useUser();
const { data: projectAccess } = useProjectAccessRights(projectUuid);
const modifiableAccessRights = useEditablePaginatedResponse(projectAccess);

const { mutate: changeAccessRights } = useUpdateAccessRightsMutation(
    projectUuid,
    modifiableAccessRights,
);

const confirmAccessRightsModification: () => void = () => {
    if (!user.value) return;

    const userAccessGroupUuids = new Set(
        user.value.memberships
            .map((m) => m.accessGroup?.uuid)
            .filter((uuid): uuid is string => !!uuid),
    );

    const hadDelete = (projectAccess.value?.data ?? []).some(
        (access) =>
            access.rights >= AccessGroupRights.DELETE &&
            userAccessGroupUuids.has(access.uuid),
    );

    const hasDelete = modifiableAccessRights.value.some(
        (access) =>
            access.rights >= AccessGroupRights.DELETE &&
            userAccessGroupUuids.has(access.uuid),
    );

    if (hadDelete && !hasDelete && user.value.role !== UserRole.ADMIN) {
        $q.dialog({
            title: 'Warning: Loss of Delete Rights',
            message:
                'You are transferring DELETE rights away from yourself. Once confirmed, you may no longer be able to delete this project, or manage its access rights. Are you sure you want to continue?',
            cancel: {
                label: 'Cancel',
                flat: true,
            },
            ok: {
                label: 'Confirm Transfer',
                color: 'negative',
                flat: true,
            },
            persistent: true,
        }).onOk(() => {
            changeAccessRights();
            onDialogOK();
        });
    } else {
        changeAccessRights();
        onDialogOK();
    }
};
</script>
