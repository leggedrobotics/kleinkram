<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        style="height: 100%"
        @click="openTagsDialog"
    >
        <slot />

        <q-tooltip v-if="!canModify">
            You need modify rights on the mission to edit its tags
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import { useQuasar } from 'quasar';
import ModifyMissionTagsDialog from 'src/dialogs/modify-mission-tags-dialog.vue';
import { canModifyMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const $q = useQuasar();
const properties = defineProps<{
    mission: MissionWithFilesDto;
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyMission(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        properties.mission.uuid,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        properties.mission.project.uuid,
        permissions.value,
    ),
);

const openTagsDialog = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: ModifyMissionTagsDialog,
        componentProps: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
