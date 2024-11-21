<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="moveMission"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to move this mission
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
import MoveMission from 'src/dialogs/MoveMissionDialog.vue';
import { Mission } from 'src/types/Mission';
import { useRouter } from 'vue-router';
import { useMissionUUID } from 'src/hooks/utils';

const $q = useQuasar();
const props = defineProps<{
    mission: Mission;
}>();
const urlMissionUUID = useMissionUUID();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyMission(
        props.mission.uuid,
        props.mission.project?.uuid,
        permissions.value,
    ),
);
const $router = useRouter();

function moveMission() {
    if (!canModify.value) return;
    $q.dialog({
        title: 'Move mission',
        component: MoveMission,
        persistent: false,
        style: 'max-width: 1500px',
        componentProps: { mission: props.mission },
    }).onOk((newProjectUUID: string) => {
        if (urlMissionUUID.value) {
            $router
                .push({
                    params: {
                        project_uuid: newProjectUUID,
                    },
                })
                .catch(console.error);
        }
    });
}
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
