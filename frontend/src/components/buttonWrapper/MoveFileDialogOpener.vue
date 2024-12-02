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
import MoveFiles from 'src/dialogs/MoveFiles.vue';
import { FileDto } from '@api/types/Files.dto';

const $q = useQuasar();
const props = defineProps<{
    mission: FileDto;
    files: FileDto[];
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (!props.mission) return false;
    return canDeleteMission(
        props.mission.mission.uuid,
        props.mission.mission.project.uuid,
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
