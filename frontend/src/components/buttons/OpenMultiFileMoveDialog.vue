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
import { useQuasar } from 'quasar';
import {
    canDeleteMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import MoveFiles from '../../dialogs/move-files.vue';
import { MissionWithFilesDto } from '@api/types/Mission.dto';

import { FileWithTopicDto } from '@api/types/files/file.dto';

const $q = useQuasar();
const properties = defineProps<{
    mission: MissionWithFilesDto;
    files: FileWithTopicDto[];
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    return canDeleteMission(
        properties.mission.uuid,
        properties.mission.project.uuid,
        permissions.value,
    );
});

const moveFiles = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: MoveFiles,
        componentProps: {
            mission: properties.mission,
            files: properties.files,
        },
        persistent: true,
    });
};
</script>

<style scoped></style>
