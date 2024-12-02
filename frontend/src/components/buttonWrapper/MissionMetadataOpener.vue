<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="openTagsDialog"
    >
        <slot />

        <q-tooltip v-if="!canModify">
            You need modify rights on the mission to edit its tags
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import {
    canModifyMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import ModifyMissionTagsDialog from 'src/dialogs/ModifyMissionTagsDialog.vue';
import { MissionDto } from '@api/types/Mission.dto';

const $q = useQuasar();
const props = defineProps<{
    mission: MissionDto;
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyMission(
        props.mission.uuid,
        props.mission.project.uuid,
        permissions.value,
    ),
);

function openTagsDialog() {
    if (!canModify.value) return;
    $q.dialog({
        component: ModifyMissionTagsDialog,
        componentProps: {
            mission: props.mission,
        },
    });
}
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<style scoped></style>
