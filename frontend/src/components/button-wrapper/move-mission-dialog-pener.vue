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
import { MissionWithFilesDto } from '@api/types/mission/mission.dto';
import { useQuasar } from 'quasar';
import MoveMission from 'src/dialogs/modify-mission-location-dialog.vue';
import { canModifyMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { useMissionUUID } from 'src/hooks/router-hooks';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

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
