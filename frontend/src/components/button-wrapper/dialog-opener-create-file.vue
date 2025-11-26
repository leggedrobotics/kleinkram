<template>
    <div @click="createNewTageType">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { MissionWithFilesDto } from '@api/types/mission/mission.dto';
import { FileUploadDto } from '@api/types/upload.dto';
import { DialogChainObject, useQuasar } from 'quasar';
import CreateFileDialog from 'src/dialogs/create-file-dialog.vue';
import { inject, Ref } from 'vue';

const $q = useQuasar();
const properties = defineProps<{
    mission?: MissionWithFilesDto;
}>();

const uploads = inject<Ref<FileUploadDto[]>>('uploads');

if (!uploads) {
    throw new Error(
        'Uploads provider is missing. Ensure this component is within the correct provider.',
    );
}

const createNewTageType = (): DialogChainObject =>
    $q.dialog({
        title: 'Create new mission',
        component: CreateFileDialog,
        componentProps: {
            mission: properties.mission,
            uploads,
        },
    });
</script>
