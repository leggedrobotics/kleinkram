<template>
    <div v-if="canModify" class="cursor-pointer" @click="moveMission">
        <slot />
    </div>
</template>

<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import { useQuasar } from 'quasar';
import MoveMission from 'src/dialogs/modify-mission-location-dialog.vue';
import { canDeleteMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { useMissionUUID } from 'src/hooks/router-hooks';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const $q = useQuasar();

const { mission } = defineProps<{
    mission: MissionWithFilesDto;
}>();
const urlMissionUUID = useMissionUUID();
const { data: permissions } = usePermissionsQuery();
// Moving takes the mission out of its project, which needs DELETE on it
// (MoveMissionToProjectGuard in the backend).
const canModify = computed(() =>
    canDeleteMission(mission.uuid, mission.project.uuid, permissions.value),
);
const $router = useRouter();

const moveMission = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        title: 'Move mission',
        component: MoveMission,
        persistent: false,
        style: 'max-width: 1500px',

        componentProps: { mission: mission },
    }).onOk((newProjectUUID: string) => {
        if (urlMissionUUID.value) {
            $router
                .push({
                    params: {
                        projectUuid: newProjectUUID,
                    },
                })
                .catch((error: unknown) => {
                    console.error(error);
                });
        }
    });
};
</script>
