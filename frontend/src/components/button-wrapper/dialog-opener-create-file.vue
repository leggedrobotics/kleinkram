<template>
    <div v-if="canUpload" style="height: 100%" @click="openCreateFileDialog">
        <slot />
    </div>
</template>

<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import type { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import { DialogChainObject, useQuasar } from 'quasar';
import CreateFileDialog from 'src/dialogs/create-file-dialog.vue';
import {
    canCreateInMission,
    hasRightsAnywhere,
    usePermissionsQuery,
} from 'src/hooks/query-hooks';
import { computed, inject, Ref } from 'vue';

const $q = useQuasar();
const properties = defineProps<{
    mission?: MissionWithFilesDto;
}>();

const { data: permissions } = usePermissionsQuery();

// Uploading needs CREATE on the mission. Without a mission (e.g. the global
// "New" menu) the user picks one later, so CREATE anywhere is enough.
const canUpload = computed(() =>
    properties.mission
        ? canCreateInMission(
              properties.mission.uuid,
              properties.mission.project.uuid,
              permissions.value,
          )
        : hasRightsAnywhere(AccessGroupRights.CREATE, permissions.value),
);

const uploads = inject<Ref<FileUploadDto[]>>('uploads');

if (!uploads) {
    throw new Error(
        'Uploads provider is missing. Ensure this component is within the correct provider.',
    );
}

const openCreateFileDialog = (): DialogChainObject =>
    $q.dialog({
        title: 'Create new mission',
        component: CreateFileDialog,
        componentProps: {
            mission: properties.mission,
            uploads,
        },
    });
</script>
