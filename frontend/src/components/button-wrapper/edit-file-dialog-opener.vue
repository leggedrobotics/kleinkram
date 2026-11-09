<template>
    <div v-if="canModify" class="cursor-pointer" @click="editFile">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { canModifyMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import NewEditFile from 'components/edit-file.vue';

const $q = useQuasar();
const { file } = defineProps<{ file: FileWithTopicDto }>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    return canModifyMission(
        file.mission.uuid,
        file.mission.project.uuid,
        permissions.value,
    );
});

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
