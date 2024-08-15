<template>
    <div @click="createNewTageType">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import CreateFileDialog from 'src/dialogs/CreateFileDialog.vue';
import { Mission } from 'src/types/Mission';

const $q = useQuasar();
const props = defineProps<{
    mission?: Mission;
}>();
const createNewTageType = () =>
    $q.dialog({
        title: 'Create new mission',
        component: CreateFileDialog,
        componentProps: {
            mission: props.mission,
        },
    });
</script>
