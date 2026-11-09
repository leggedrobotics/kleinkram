<template>
    <div v-if="canModify" class="cursor-pointer" @click="editFile">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { AccessGroupRights } from '@kleinkram/shared';
import { useQuasar } from 'quasar';
import {
    canModifyFiles,
    usePermissionsQuery,
    useUser,
} from 'src/hooks/query-hooks';
import { computed } from 'vue';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import NewEditFile from 'components/edit-file.vue';

const $q = useQuasar();
const { file } = defineProps<{ file: FileWithTopicDto }>();
const { data: permissions } = usePermissionsQuery();
const { data: user } = useUser();
const canModify = computed(() =>
    canModifyFiles(
        [file],
        file.mission.uuid,
        file.mission.project.uuid,
        AccessGroupRights.WRITE,
        user.value?.uuid,
        permissions.value,
    ),
);

const editFile = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: NewEditFile,
        componentProps: {
            fileUuid: file.uuid,
        },
        persistent: true,
    });
};
</script>
