<template>
    <div @click="createNewTageType">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import CreateFileDialog from 'src/dialogs/CreateFileDialog.vue';
import { Mission } from 'src/types/Mission';
import { FileUpload } from 'src/types/FileUpload';
import { inject, Ref } from 'vue';

const $q = useQuasar();
const props = defineProps<{
    mission?: Mission;
}>();
const uploads = inject('uploads') as Ref<FileUpload[]>;
const createNewTageType = () =>
    $q.dialog({
        title: 'Create new mission',
        component: CreateFileDialog,
        componentProps: {
            mission: props.mission,
            uploads,
        },
    });
</script>
