<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': !canModify,
        }"
        @click="editMission"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to modify this mission
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { MissionWithFilesDto } from '@api/types/mission/mission.dto';
import { useQuasar } from 'quasar';
import EditMissionDialog from 'src/dialogs/modify-mission-dialog.vue';
import { canModifyMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const $q = useQuasar();
const { mission } = defineProps<{
    mission: MissionWithFilesDto;
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    return canModifyMission(
        mission.uuid,
        mission.project.uuid,
        permissions.value,
    );
});

const editMission = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: EditMissionDialog,
        componentProps: {
            mission: mission,
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
