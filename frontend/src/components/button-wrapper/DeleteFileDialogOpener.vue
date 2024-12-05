<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': !canModify,
        }"
        @click="deleteFile"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to delete this file
        </q-tooltip>
    </div>
</template>
<script setup lang="ts">
import { useQuasar } from 'quasar';
import DeleteFileDialog from '../../dialogs/delete-file-dialog.vue';
import {
    canDeleteMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';

import { FileWithTopicDto } from '@api/types/files/file.dto';

const properties = defineProps<{
    file: FileWithTopicDto;
}>();

const $q = useQuasar();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (!properties.file) return false;
    return canDeleteMission(
        properties.file.mission.uuid,
        properties.file.mission.project.uuid,
        permissions.value,
    );
});

const deleteFile = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        title: 'Delete File',
        component: DeleteFileDialog,
        componentProps: {
            file: properties.file,
        },
    });
};
</script>

<style scoped></style>
