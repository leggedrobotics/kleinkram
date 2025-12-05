<template>
    <q-btn
        flat
        color="white"
        icon="sym_o_category"
        label="Add Categories"
        :disable="!canModify"
        @click="addCategories"
    >
        <q-tooltip> Add Categories</q-tooltip>
    </q-btn>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import AddMultiCategory from 'src/dialogs/add-multi-category.vue';
import { canModifyMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission.dto';

const $q = useQuasar();
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { mission, files } = defineProps<{
    mission: MissionWithFilesDto;
    files: FileWithTopicDto[];
}>();
const { data: permissions } = usePermissionsQuery();

const canModify = computed(() =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    canModifyMission(mission.uuid, mission.project.uuid, permissions.value),
);

const addCategories = (): void => {
    if (!canModify.value) return;

    $q.dialog({
        component: AddMultiCategory,
        componentProps: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            projectUuid: mission.project.uuid,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            missionUuid: mission.uuid,
            files: files,
        },
        persistent: true,
    });
};
</script>

<style scoped></style>
