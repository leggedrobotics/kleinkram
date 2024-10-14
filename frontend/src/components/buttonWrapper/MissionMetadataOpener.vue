<template>
    <div
        @click="openTagsDialog"
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
    >
        <slot />

        <q-tooltip v-if="!canModify">
            You need modify rights on the mission to edit its tags
        </q-tooltip>
    </div>
</template>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import {
    canModifyMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed, watch } from 'vue';
import { Mission } from 'src/types/Mission';
import ModifyMissionTagsDialog from 'src/dialogs/ModifyMissionTagsDialog.vue';

const $q = useQuasar();
const props = defineProps<{
    mission: Mission;
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyMission(
        props.mission.uuid,
        props.mission.project?.uuid,
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

<style scoped></style>
