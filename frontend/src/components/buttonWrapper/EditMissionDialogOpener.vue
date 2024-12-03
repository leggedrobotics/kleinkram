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
import { useQuasar } from 'quasar';
import {
    canModifyMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import EditMissionDialog from 'src/dialogs/EditMissionDialog.vue';
import { MissionDto } from '@api/types/Mission.dto';

const $q = useQuasar();
const properties = defineProps<{
    mission: MissionDto;
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (!properties.mission) return false;
    return canModifyMission(
        properties.mission.uuid,
        properties.mission.project.uuid,
        permissions.value,
    );
});

const editMission = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: EditMissionDialog,
        componentProps: {
            mission: properties.mission,
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
