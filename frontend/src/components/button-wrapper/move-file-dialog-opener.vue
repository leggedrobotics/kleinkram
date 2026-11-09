<template>
    <div v-if="canModify" class="cursor-pointer" @click="moveFiles">
        <slot />
    </div>
</template>

<script setup lang="ts">
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
import type { MissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';

const $q = useQuasar();
const { mission, files } = defineProps<{
    mission: MissionDto;
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
