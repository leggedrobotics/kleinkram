<template>
    <q-card-section class="q-pa-md">
        <p>
            Please confirm by entering the Filename: <b>{{ file.filename }}</b>
        </p>
        <q-input
            v-model="fileNameCheck"
            outlined
            placeholder="Confirm File Name"
            autofocus
        />
    </q-card-section>
</template>
<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { isAxiosError } from 'axios';
import { Notify } from 'quasar';
import ROUTES from 'src/router/routes';
import { deleteFile } from 'src/services/mutations/file';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';

const fileNameCheck = ref('');
const client = useQueryClient();

const route = useRoute();
const router = useRouter();

async function deleteFileAction(): Promise<void> {
    if (fileNameCheck.value !== properties.file.filename) return;

    try {
        await deleteFile(properties.file);
    } catch (error: unknown) {
        const errorMessage =
            (isAxiosError(error)
                ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  (error.response?.data?.message as string | undefined)
                : undefined) ??
            (error instanceof Error ? error.message : undefined) ??
            'Unknown error';

        Notify.create({
            message: `Error deleting file: ${errorMessage}`,
            color: 'negative',
            position: 'bottom',
        });
        return;
    }

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
    client.removeQueries({ queryKey: ['file', properties.file.uuid] });

    await client.invalidateQueries({
        predicate: (query) =>
            query.queryKey[0] === 'files' ||
            query.queryKey[0] === 'Filtered Files' ||
            query.queryKey[0] === 'missions',
    });
}

const properties = defineProps<{
    file: FileWithTopicDto;
}>();

defineExpose({
    deleteFileAction,

    // eslint-disable-next-line @typescript-eslint/naming-convention
    file_name_check: fileNameCheck,
});
</script>
<style scoped></style>
