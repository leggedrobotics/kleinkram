<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': canModify,
            'cursor-not-allowed': !canModify,
        }"
        @click="moveFiles"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to move these files / this file
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import {
    canDeleteMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import { FileEntity } from 'src/types/FileEntity';
import MoveFiles from 'src/dialogs/MoveFiles.vue';

const $q = useQuasar();
const props = defineProps<{
    mission: FileEntity;
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

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
