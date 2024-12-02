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
import { ref } from 'vue';
import { deleteFile } from 'src/services/mutations/file';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import ROUTES from 'src/router/routes';
import { FileDto } from '@api/types/Files.dto';

const fileNameCheck = ref('');
const client = useQueryClient();

const route = useRoute();
const router = useRouter();

async function deleteFileAction() {
    if (fileNameCheck.value === props.file.filename) {
        await deleteFile(props.file)
            .then(async () => {
                await client.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'files' ||
                        (query.queryKey[0] === 'file' &&
                            query.queryKey[1] === props.file.uuid) ||
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
                            project_uuid: route.params.project_uuid,
                            mission_uuid: route.params.mission_uuid,
                        },
                    });
                }
            })
            .catch((e) => {
                Notify.create({
                    message: `Error deleting file: ${e.response.data.message}`,
                    color: 'negative',
                    position: 'bottom',
                });
            });
    }
}

const props = defineProps<{
    file: FileDto;
}>();

defineExpose({
    deleteFileAction,
    file_name_check: fileNameCheck,
});
</script>
<style scoped></style>
