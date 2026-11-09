<template>
    <div
        v-if="canModify"
        class="cursor-pointer"
        style="height: 100%"
        @click="openMetadataDialog"
    >
        <slot />
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
