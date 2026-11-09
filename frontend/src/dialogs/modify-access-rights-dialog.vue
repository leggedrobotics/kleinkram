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
import { useUpdateAccessRightsMutation } from 'src/hooks/mutation-hooks';
import {
    useProjectAccessRights,
    useProjectQuery,
    useUser,
} from 'src/hooks/query-hooks';
import { useEditablePaginatedResponse } from 'src/hooks/utility-hooks';
import { formatSize } from 'src/services/general-formatting';

const { projectUuid: projectUuid } = defineProps<{ projectUuid: string }>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const $q = useQuasar();

const { data: user } = useUser();
const { data: project } = useProjectQuery(projectUuid);
const { data: projectAccess } = useProjectAccessRights(projectUuid);
const modifiableAccessRights = useEditablePaginatedResponse(projectAccess);

const { mutate: changeAccessRights } = useUpdateAccessRightsMutation(
    projectUuid,
    modifiableAccessRights,
);

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
        title: `Make “${project.value?.name ?? 'this project'}” public?`,
        message:
            `All Kleinkram users, including everyone who signs up later, ` +
            `will be able to view and download this project ` +
            `(${missions}, ${size}). You can make it restricted again at ` +
            `any time, but files that were already downloaded cannot be ` +
            `taken back.`,
        cancel: {
            label: 'Cancel',
            flat: true,
        },
        ok: {
            label: 'Make public',
            color: 'positive',
            flat: true,
        },
        persistent: true,
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
