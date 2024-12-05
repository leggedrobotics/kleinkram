<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="openTagsDialog"
    >
        <slot />

        <q-tooltip v-if="!canModify">
            You need modify rights on the mission to edit its tags
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
import ModifyMissionTagsDialog from '../../dialogs/modify-mission-tags-dialog.vue';
import { MissionWithFilesDto } from '@api/types/Mission.dto';

const $q = useQuasar();
const properties = defineProps<{
    mission: MissionWithFilesDto;
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyMission(
        properties.mission.uuid,
        properties.mission.project.uuid,
        permissions.value,
    ),
);

const openTagsDialog = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: ModifyMissionTagsDialog,
        componentProps: {
            mission: properties.mission,
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
