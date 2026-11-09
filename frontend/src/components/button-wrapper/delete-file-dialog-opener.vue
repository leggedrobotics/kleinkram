<template>
    <div v-if="canModify" class="cursor-pointer" @click="deleteFile">
        <slot />
    </div>
</template>
<script setup lang="ts">
import { AccessGroupRights } from '@kleinkram/shared';
import { useQuasar } from 'quasar';
import DeleteFileDialog from 'src/dialogs/delete-file-dialog.vue';
import {
    canModifyFiles,
    usePermissionsQuery,
    useUser,
} from 'src/hooks/query-hooks';
import { computed } from 'vue';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';

const { file } = defineProps<{ file: FileWithTopicDto }>();

const $q = useQuasar();
const { data: permissions } = usePermissionsQuery();
const { data: user } = useUser();
const canModify = computed(() =>
    canModifyFiles(
        [file],
        file.mission.uuid,
        file.mission.project.uuid,
        AccessGroupRights.DELETE,
        user.value?.uuid,
        permissions.value,
    ),
);

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
