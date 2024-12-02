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
import AddMultiCategory from 'src/dialogs/AddMultiCategory.vue';
import { FileDto } from '@api/types/Files.dto';

const $q = useQuasar();
const props = defineProps<{
    mission: FileDto;
    files: FileDto[];
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    return canModifyMission(
        props.mission.mission.uuid,
        props.mission.mission.project.uuid,
        permissions.value,
    );
});

const addCategories = (): void => {
    $q.dialog({
        component: AddMultiCategory,
        componentProps: {
            project_uuid: props.mission.mission.project.uuid,
            files: props.files,
            mission_uuid: props.mission.uuid,
        },
        persistent: true,
    });
};
</script>

<style scoped></style>
