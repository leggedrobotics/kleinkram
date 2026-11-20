<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="isPending"
        size="lg"
    >
        <template #title>Change Access Rights</template>

        <template #content>
            <access-rights-manager
                v-model="modifiableAccessRights"
                :general-access-disabled="!canChangeGeneralAccess"
            />
        </template>

        <template #actions>
            <q-btn
                flat
                no-caps
                label="Save Changes"
                class="bg-button-primary"
                :loading="isPending"
                @click="confirmMakingPublic"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { ProjectAccessDto } from '@kleinkram/api-dto/types/access-control/project-access.dto';
import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@kleinkram/shared';
import AccessRightsManager from 'components/configure-access-rights/access-rights-manager.vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import ConfirmDialog from 'src/dialogs/confirm-dialog.vue';
import { useUpdateAccessRightsMutation } from 'src/hooks/mutation-hooks';
import {
    canDeleteProject,
    usePermissionsQuery,
    useProjectAccessRights,
    useProjectQuery,
    useUser,
} from 'src/hooks/query-hooks';
import { useEditablePaginatedResponse } from 'src/hooks/utility-hooks';
import { getDialogErrorMessage } from 'src/services/error-handling';
import { formatSize } from 'src/services/general-formatting';
import { computed, ref } from 'vue';

const { projectUuid: projectUuid } = defineProps<{ projectUuid: string }>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const $q = useQuasar();

const { data: user } = useUser();
const { data: project } = useProjectQuery(projectUuid);
const { data: projectAccess } = useProjectAccessRights(projectUuid);
const modifiableAccessRights = useEditablePaginatedResponse(projectAccess);

const { data: permissions } = usePermissionsQuery();
const canChangeGeneralAccess = computed(() =>
    canDeleteProject(projectUuid, permissions.value),
);

const { mutateAsync: changeAccessRights, isPending } =
    useUpdateAccessRightsMutation(projectUuid, modifiableAccessRights);

const hasPublicAccess = (accessRights: ProjectAccessDto[]): boolean =>
    accessRights.some((access) => access.type === AccessGroupType.PUBLIC);

/**
 * Making a project public shares every file with every user, so ask before
 * doing so. Making it restricted again needs no confirmation.
 */
const confirmMakingPublic = (): void => {
    const wasPublic = hasPublicAccess(projectAccess.value?.data ?? []);
    if (wasPublic || !hasPublicAccess(modifiableAccessRights.value)) {
        confirmAccessRightsModification();
        return;
    }

    const missionCount = project.value?.missionCount ?? 0;
    const missions = `${missionCount.toString()} ${missionCount === 1 ? 'mission' : 'missions'}`;
    const size = formatSize(project.value?.size ?? 0);

    $q.dialog({
        component: ConfirmDialog,
        componentProps: {
            title: 'Make Project Public',
            subtitle: project.value?.name,
            message:
                `Every Kleinkram user will be able to view and download ` +
                `its ${missions} (${size}). Downloaded files can't be taken back.`,
            okLabel: 'Make Public',
        },
    }).onOk(confirmAccessRightsModification);
};

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
            component: ConfirmDialog,
            componentProps: {
                title: 'Give Up Delete Rights?',
                message:
                    'You will no longer be able to delete this project or manage its access rights.',
                okLabel: 'Transfer Rights',
                danger: true,
                // saved while this question stays open; a failure shows here
                action: () => changeAccessRights(),
            },
        }).onOk(() => {
            onDialogOK();
        });
    } else {
        void saveAccessRights();
    }
};

const errorMessage = ref('');

/** Saves the access rights; the dialog stays open if that fails */
async function saveAccessRights(): Promise<void> {
    errorMessage.value = '';
    try {
        await changeAccessRights();
    } catch (error: unknown) {
        errorMessage.value = getDialogErrorMessage(error);
        return;
    }
    onDialogOK();
}
</script>
