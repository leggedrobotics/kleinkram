<template>
    <q-btn
        v-if="canModify"
        flat
        dense
        padding="6px"
        label="Move"
        icon="sym_o_move_down"
        color="white"
        @click="moveFiles"
    >
        <q-tooltip> Move Files to another Mission</q-tooltip>
    </q-btn>
</template>
<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import { useQuasar } from 'quasar';
import MoveFiles from 'src/dialogs/modify-file-location-dialog.vue';
import {
    canModifyFiles,
    usePermissionsQuery,
    useUser,
} from 'src/hooks/query-hooks';
import { computed } from 'vue';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';

const $q = useQuasar();

const { mission, files } = defineProps<{
    mission: MissionWithFilesDto;
    files: FileWithTopicDto[];
}>();

const { data: permissions } = usePermissionsQuery();
const { data: user } = useUser();

const canModify = computed(() =>
    canModifyFiles(
        files,
        mission.uuid,
        mission.project.uuid,
        AccessGroupRights.DELETE,
        user.value?.uuid,
        permissions.value,
    ),
);

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
