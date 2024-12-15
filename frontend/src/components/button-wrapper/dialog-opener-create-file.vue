<template>
    <div @click="createNewTageType">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import CreateFileDialog from '../../dialogs/create-file-dialog.vue';
import { inject } from 'vue';
import { MissionWithFilesDto } from '@api/types/mission.dto';

const $q = useQuasar();
const properties = defineProps<{
    mission?: MissionWithFilesDto;
}>();
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
