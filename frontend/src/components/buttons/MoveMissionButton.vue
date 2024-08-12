<template>
    <q-btn
        color="primary"
        outline
        icon="sym_o_move_down"
        label="Move"
        @click="moveMissionToDifferentProject"
    >
        <q-tooltip> Move the Mission another Project </q-tooltip>
    </q-btn>
</template>

<script setup lang="ts">
import MoveMissionDialog from 'src/dialogs/MoveMissionDialog.vue';
import { useQuasar } from 'quasar';
import { Mission } from 'src/types/Mission';

const { mission } = defineProps({
    mission: Mission,
});

const $q = useQuasar();

const moveMissionToDifferentProject = () =>
    $q.dialog({
        title: 'Move Mission',
        component: MoveMissionDialog,
        componentProps: {
            mission,
        },
    });
</script>
