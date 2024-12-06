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
import { canDeleteMission, usePermissionsQuery } from '../../hooks/query-hooks';
import { computed } from 'vue';
import MoveFiles from '../../dialogs/modify-file-location-dialog.vue';

import { FileWithTopicDto } from '@api/types/files/file.dto';
import { MissionDto } from '@api/types/Mission.dto';

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
