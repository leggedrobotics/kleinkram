<template>
    <q-card-section class="q-pa-md">
        <h5>Delete File</h5>
        <p>Please confirm by entering the Filename: {{ file.filename }}</p>
        <q-input v-model="filenamecheck" label="Filename" />
        <div class="q-mt-md row">
            <div class="col-10" />
            <div class="col-2">
                <q-btn
                    label="DELETE"
                    color="red"
                    @click="_deleteFile"
                    :disable="filenamecheck !== file.filename"
                />
            </div>
        </div>
    </q-card-section>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { FileEntity } from 'src/types/FileEntity';
import { deleteFile } from 'src/services/mutations/file';
import { useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';

const filenamecheck = ref('');
const client = useQueryClient();

async function _deleteFile() {
    if (filenamecheck.value === props.file.filename) {
        await deleteFile(props.file)
            .then(() => {
                client.invalidateQueries({
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
    file: FileEntity;
}>();
</script>
<style scoped></style>
