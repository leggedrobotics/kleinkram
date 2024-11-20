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
import { FileEntity } from 'src/types/FileEntity';
import AddMultiCategory from 'src/dialogs/AddMultiCategory.vue';

const $q = useQuasar();
const props = defineProps<{
    mission: FileEntity;
    files: FileEntity[];
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (!props.mission) return false;
    return canModifyMission(
        props.mission.uuid,
        props.mission.project?.uuid,
        permissions.value,
    );
});

function addCategories() {
    if (!canModify.value) return;
    $q.dialog({
        component: AddMultiCategory,
        componentProps: {
            project_uuid: props.mission.project?.uuid,
            files: props.files,
            mission_uuid: props.mission.uuid,
        },
        persistent: true,
    });
}
</script>

<style scoped></style>
