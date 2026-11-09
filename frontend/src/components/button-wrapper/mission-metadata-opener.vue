<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-not-allowed': !canModify,
        }"
        style="height: 100%"
        @click="openMetadataDialog"
    >
        <slot />

        <q-tooltip v-if="!canModify">
            You need modify rights on the mission to edit its metadata
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import { useQuasar } from 'quasar';
import ModifyMissionMetadataDialog from 'src/dialogs/modify-mission-metadata-dialog.vue';
import { canModifyMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

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

const openMetadataDialog = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: ModifyMissionMetadataDialog,
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
