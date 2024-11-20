<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': !canModify,
        }"
        @click="editMission"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to modify this mission
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
import { Mission } from 'src/types/Mission';
import EditMissionDialog from 'src/dialogs/EditMissionDialog.vue';

const $q = useQuasar();
const props = defineProps<{
    mission: Mission;
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

function editMission() {
    if (!canModify.value) return;
    $q.dialog({
        component: EditMissionDialog,
        componentProps: {
            mission: props.mission,
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
