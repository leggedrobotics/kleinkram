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
import { Notify } from 'quasar';
import ROUTES from 'src/router/routes';
import { deleteFile } from 'src/services/mutations/file';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { FileWithTopicDto } from '@api/types/file/file.dto';

const fileNameCheck = ref('');
const client = useQueryClient();

const route = useRoute();
const router = useRouter();

async function deleteFileAction(): Promise<void> {
    if (fileNameCheck.value === properties.file.filename) {
        await deleteFile(properties.file)
            .then(async () => {
                await client.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'files' ||
                        (query.queryKey[0] === 'file' &&
                            query.queryKey[1] === properties.file.uuid) ||
                        query.queryKey[0] === 'Filtered Files',
                });
                Notify.create({
                    message: 'File deleted',
                    color: 'positive',
                    timeout: 2000,
                    position: 'bottom',
                });

                // Redirect to missions page if we are on the file page
                if (route.name === ROUTES.FILE.routeName) {
                    await router.push({
                        name: ROUTES.FILES.routeName,
                        params: {
                            projectUuid: route.params.projectUuid,
                            missionUuid: route.params.missionUuid,
                        },
                    });
                }
            })
            .catch((error: unknown) => {
                let errorMessage = '';
                errorMessage =
                    error instanceof Error
                        ? error.message
                        : ((
                              error as {
                                  response?: { data?: { message?: string } };
                              }
                          ).response?.data?.message ?? 'Unknown error');

                Notify.create({
                    message: `Error deleting file: ${errorMessage}`,
                    color: 'negative',
                    position: 'bottom',
                });
            });
    }
}

const properties = defineProps<{
    file: FileWithTopicDto;
}>();

defineExpose({
    deleteFileAction,
    file_name_check: fileNameCheck,
});
</script>
<style scoped></style>
