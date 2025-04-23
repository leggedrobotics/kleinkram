<template>
    <div @click="createNewTageType">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { MissionWithFilesDto } from '@api/types/mission/mission.dto';
import { useQuasar } from 'quasar';
import CreateFileDialog from 'src/dialogs/create-file-dialog.vue';
import { inject } from 'vue';

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
