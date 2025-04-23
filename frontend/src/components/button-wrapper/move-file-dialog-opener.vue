<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': canModify,
            'cursor-not-allowed': !canModify,
        }"
        @click="moveFiles"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to move these files / this file
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import MoveFiles from 'src/dialogs/modify-file-location-dialog.vue';
import { canDeleteMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

import { FileWithTopicDto } from '@api/types/file/file.dto';
import { MissionDto } from '@api/types/mission/mission.dto';

const $q = useQuasar();
const { mission, files } = defineProps<{
    mission: MissionDto;
    files: FileWithTopicDto[];
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    return canDeleteMission(
        mission.uuid,
        mission.project.uuid,
        permissions.value,
    );
});

const moveFiles = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: MoveFiles,
        componentProps: {
            mission: mission,
            files: files,
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
