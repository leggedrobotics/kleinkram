<template>
    <div @click="moveMissionToDifferentProject">
        <slot />
    </div>
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
