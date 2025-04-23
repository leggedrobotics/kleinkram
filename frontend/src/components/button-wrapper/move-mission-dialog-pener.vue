<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="moveMission"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to move this mission
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { canModifyMission, usePermissionsQuery } from '@hooks/query-hooks';
import { computed } from 'vue';
import MoveMission from '../../dialogs/modify-mission-location-dialog.vue';
import { useRouter } from 'vue-router';
import { MissionWithFilesDto } from '@api/types/mission/mission.dto';
import { useMissionUUID } from '@hooks/router-hooks';

const $q = useQuasar();
const { mission } = defineProps<{
    mission: MissionWithFilesDto;
}>();
const urlMissionUUID = useMissionUUID();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyMission(mission.uuid, mission.project.uuid, permissions.value),
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

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
