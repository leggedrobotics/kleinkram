<template>
    <q-btn
        flat
        dense
        label="Move"
        icon="sym_o_move_down"
        color="white"
        :disable="!canModify"
        @click="moveFiles"
    >
        <q-tooltip> Move Files to another Mission</q-tooltip>
    </q-btn>
    Move
</template>
<script setup lang="ts">
import { MissionWithFilesDto } from '@api/types/mission/mission.dto';
import { useQuasar } from 'quasar';
import MoveFiles from 'src/dialogs/modify-file-location-dialog.vue';
import { canDeleteMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

import { FileWithTopicDto } from '@api/types/file/file.dto';

const $q = useQuasar();

const { mission, files } = defineProps<{
    mission: MissionWithFilesDto;
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

<style scoped></style>
