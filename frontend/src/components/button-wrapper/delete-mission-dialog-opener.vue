<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="deleteMission"
    >
        <slot />
        <q-tooltip v-if="!canModify && fileCount === 0">
            You do not have permission to move this mission
        </q-tooltip>
        <q-tooltip v-if="!canModify && fileCount > 0">
            You cannot delete a mission with files
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import {
    FlatMissionDto,
    MissionWithFilesDto,
} from '@kleinkram/api-dto/types/mission/mission.dto';
import { useQuasar } from 'quasar';
import DeleteMissionDialog from 'src/dialogs/delete-mission-dialog.vue';
import { canModifyMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const $q = useQuasar();
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { mission } = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    mission: FlatMissionDto | MissionWithFilesDto;
}>();
const { data: permissions } = usePermissionsQuery();

const fileCount = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return 'filesCount' in mission ? mission.filesCount : mission.files.length;
});

const canModify = computed(() => {
    if (fileCount.value > 0) {
        return false;
    }
    return canModifyMission(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        mission.uuid,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        mission.project.uuid,
        permissions.value,
    );
});

const deleteMission = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        title: 'Delete Mission',
        component: DeleteMissionDialog,
        componentProps: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            missionUuid: mission.uuid,
        },
    });
};
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<style scoped></style>
