<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': !canModify,
        }"
        @click="editFile"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to modify this project
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { canModifyMission, usePermissionsQuery } from '../../hooks/query-hooks';
import { computed } from 'vue';

import { FileWithTopicDto } from '@api/types/files/file.dto';
import NewEditFile from '../new-edit-file.vue';

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

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
