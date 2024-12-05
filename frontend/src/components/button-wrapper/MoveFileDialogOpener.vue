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
import {
    canDeleteMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import MoveFiles from '../../dialogs/move-files.vue';

import { FileWithTopicDto } from '@api/types/files/file.dto';

const $q = useQuasar();
const properties = defineProps<{
    mission: FileWithTopicDto;
    files: FileWithTopicDto[];
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (!properties.mission) return false;
    return canDeleteMission(
        properties.mission.mission.uuid,
        properties.mission.mission.project.uuid,
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

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
