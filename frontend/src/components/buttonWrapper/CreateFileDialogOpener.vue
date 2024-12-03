<template>
    <div @click="createNewTageType">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import CreateFileDialog from 'src/dialogs/CreateFileDialog.vue';
import { inject } from 'vue';
import { MissionDto } from '@api/types/Mission.dto';

const $q = useQuasar();
const properties = defineProps<{
    mission?: MissionDto;
}>();
const uploads = inject('uploads')!;
const createNewTageType = () =>
    $q.dialog({
        title: 'Create new mission',
        component: CreateFileDialog,
        componentProps: {
            mission: properties.mission,
            uploads,
        },
    });
</script>
