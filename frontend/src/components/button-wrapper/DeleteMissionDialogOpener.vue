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
        <q-tooltip v-if="!canModify && props.mission.files.count === 0">
            You do not have permission to move this mission
        </q-tooltip>
        <q-tooltip v-if="!canModify && props.mission.files.count > 0">
            You cannot delete a mission with files
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import {
    canModifyMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import DeleteMissionDialog from '../../dialogs/delete-mission-dialog.vue';
import { MissionWithFilesDto } from '@api/types/Mission.dto';

const $q = useQuasar();
const props = defineProps<{
    mission: MissionWithFilesDto;
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (props.mission.filesCount > 0) {
        return false;
    }
    return canModifyMission(
        props.mission.uuid,
        props.mission.project.uuid,
        permissions.value,
    );
});

const deleteMission = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        title: 'Delete Mission',
        component: DeleteMissionDialog,
        componentProps: {
            mission_uuid: props.mission.uuid,
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
