<template>
    <q-btn
        class="button-border"
        flat
        color="primary"
        icon="sym_o_sell"
        label="Metadata"
        @click="openTagsDialog"
        :disable="!canModify"
    >
        <q-tooltip> Manage Metadata Tags</q-tooltip>
    </q-btn>
</template>

<style scoped></style>

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
    $q.dialog({
        component: ModifyMissionTagsDialog,
        componentProps: {
            mission: props.mission,
        },
    });
}
</script>

<style scoped></style>
