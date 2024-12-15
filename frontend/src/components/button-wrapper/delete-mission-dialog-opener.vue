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
        <q-tooltip v-if="!canModify && mission.filesCount === 0">
            You do not have permission to move this mission
        </q-tooltip>
        <q-tooltip v-if="!canModify && mission.filesCount > 0">
            You cannot delete a mission with files
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { canModifyMission, usePermissionsQuery } from '../../hooks/query-hooks';
import { computed } from 'vue';
import DeleteMissionDialog from '../../dialogs/delete-mission-dialog.vue';
import { FlatMissionDto } from '@api/types/mission.dto';

const $q = useQuasar();
const { mission } = defineProps<{ mission: FlatMissionDto }>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (mission.filesCount > 0) {
        return false;
    }
    return canModifyMission(
        mission.uuid,
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
