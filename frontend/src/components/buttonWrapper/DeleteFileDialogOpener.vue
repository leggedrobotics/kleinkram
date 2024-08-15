<template>
    <div @click="deleteFile">
        <slot />
    </div>
</template>
<script setup lang="ts">
import { useQuasar } from 'quasar';
import DeleteFileDialog from 'src/dialogs/DeleteFileDialog.vue';
import { FileEntity } from 'src/types/FileEntity';

const props = defineProps<{
    file: FileEntity;
}>();

const $q = useQuasar();

function deleteFile() {
    $q.dialog({
        title: 'Delete File',
        component: DeleteFileDialog,
        componentProps: {
            file: props.file,
        },
    });
}
</script>

<style scoped></style>
