<template>
    <div style="height: 100%" @click="createNewTageType">
        <slot />
    </div>
</template>

<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import type { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
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
