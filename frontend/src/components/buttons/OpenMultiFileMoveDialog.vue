<template>
    <q-btn
        flat
        dense
        label="Move"
        icon="sym_o_move_down"
        color="white"
        :disable="!canModify"
        @click="moveFiles"
    >
        <q-tooltip> Move Files to another Mission</q-tooltip>
    </q-btn>
    Move
</template>
<script setup lang="ts">
import { useQuasar } from 'quasar';
import {
    canDeleteMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import MoveFiles from 'src/dialogs/MoveFiles.vue';

const $q = useQuasar();
const props = defineProps<{
    mission: Mission;
    files: FileEntity[];
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (!props.mission) return false;
    return canDeleteMission(
        props.mission.uuid,
        props.mission.project?.uuid,
        permissions.value,
    );
});

function moveFiles() {
    if (!canModify.value) return;
    $q.dialog({
        component: MoveFiles,
        componentProps: {
            mission: props.mission,
            files: props.files,
        },
        persistent: true,
    });
}
</script>

<style scoped></style>
