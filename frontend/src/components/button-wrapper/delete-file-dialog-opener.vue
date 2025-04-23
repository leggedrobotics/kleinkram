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
import DeleteFileDialog from 'src/dialogs/delete-file-dialog.vue';
import { canDeleteMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

import { FileWithTopicDto } from '@api/types/file/file.dto';

const { file } = defineProps<{ file: FileWithTopicDto }>();

const $q = useQuasar();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    return canDeleteMission(
        file.mission.uuid,
        file.mission.project.uuid,
        permissions.value,
    );
});

const deleteFile = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        title: 'Delete File',
        component: DeleteFileDialog,
        componentProps: {
            file: file,
        },
    });
};
</script>

<style scoped></style>
