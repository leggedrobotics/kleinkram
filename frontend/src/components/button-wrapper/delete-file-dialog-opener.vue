<template>
    <div v-if="canModify" class="cursor-pointer" @click="openDeleteDialog">
        <slot />
    </div>
</template>
<script setup lang="ts">
import { AccessGroupRights } from '@kleinkram/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify, useQuasar } from 'quasar';
import ConfirmDeleteFileDialog from 'src/dialogs/confirm-delete-file-dialog.vue';
import {
    canModifyFiles,
    usePermissionsQuery,
    useUser,
} from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { deleteFile } from 'src/services/mutations/file';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';

const { file } = defineProps<{ file: FileWithTopicDto }>();

const $q = useQuasar();
const client = useQueryClient();
const route = useRoute();
const router = useRouter();
const { data: permissions } = usePermissionsQuery();
const { data: user } = useUser();
const canModify = computed(() =>
    canModifyFiles(
        [file],
        file.mission.uuid,
        file.mission.project.uuid,
        AccessGroupRights.DELETE,
        user.value?.uuid,
        permissions.value,
    ),
);

/** After the dialog deleted the file: confirm it and update the views */
async function afterDelete(): Promise<void> {
    // Confirm the deletion before touching the query cache: invalidating the
    // queries first delays the feedback by the (retried) refetches it triggers.
    Notify.create({
        message: 'File deleted',
        color: 'positive',
        timeout: 2000,
        position: 'bottom',
    });

    // Leave the file page before its file query is dropped, otherwise the page
    // refetches the file we just deleted and reports it as unloadable.
    if (route.name === ROUTES.FILE.routeName) {
        await router.push({
            name: ROUTES.FILES.routeName,
            params: {
                projectUuid: route.params.projectUuid,
                missionUuid: route.params.missionUuid,
            },
        });
    }

    // The file is gone, so its query is removed instead of invalidated
    // (refetching it would only produce a 404).
    client.removeQueries({ queryKey: ['file', file.uuid] });

    await client.invalidateQueries({
        predicate: (query) =>
            query.queryKey[0] === 'files' ||
            query.queryKey[0] === 'Filtered Files' ||
            query.queryKey[0] === 'missions',
    });
}

const openDeleteDialog = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: ConfirmDeleteFileDialog,
        componentProps: {
            filename: file.filename,
            // a failure is shown in the dialog, which stays open
            action: () => deleteFile(file),
        },
    }).onOk(() => {
        void afterDelete();
    });
};
</script>
