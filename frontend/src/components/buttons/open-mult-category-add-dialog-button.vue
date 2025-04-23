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

import { FileWithTopicDto } from '@api/types/file/file.dto';
import { MissionWithFilesDto } from '@api/types/mission/mission.dto';

const $q = useQuasar();
const { mission, files } = defineProps<{
    mission: MissionWithFilesDto;
    files: FileWithTopicDto[];
}>();
const { data: permissions } = usePermissionsQuery();

const canModify = computed(() =>
    canModifyMission(mission.uuid, mission.project.uuid, permissions.value),
);

const addCategories = (): void => {
    if (!canModify.value) return;

    $q.dialog({
        component: AddMultiCategory,
        componentProps: {
            projectUuid: mission.project.uuid,
            missionUuid: mission.uuid,
            files: files,
        },
        persistent: true,
    });
};
</script>

<style scoped></style>
