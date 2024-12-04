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
import {
    canModifyMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import AddMultiCategory from '../../dialogs/add-multi-category.vue';

import { FileDto } from '@api/types/files/file.dto';

const $q = useQuasar();
const properties = defineProps<{
    mission: FileDto;
    files: FileDto[];
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    return canModifyMission(
        properties.mission.mission.uuid,
        properties.mission.mission.project.uuid,
        permissions.value,
    );
});

const addCategories = (): void => {
    $q.dialog({
        component: AddMultiCategory,
        componentProps: {
            project_uuid: properties.mission.mission.project.uuid,
            files: properties.files,
            mission_uuid: properties.mission.uuid,
        },
        persistent: true,
    });
};
</script>

<style scoped></style>
