<template>
    <div @click="deleteFile">
        <slot />
    </div>
</template>
<script setup lang="ts">
import { useQuasar } from 'quasar';
import DeleteMissionDialog from 'src/dialogs/DeleteMissionDialog.vue';

const { mission_uuid } = defineProps<{
    mission_uuid: string;
}>();

const $q = useQuasar();

const deleteFile = () =>
    $q.dialog({
        title: 'Delete File',
        component: DeleteMissionDialog,
        componentProps: {
            mission_uuid,
        },
    });
</script>

<style scoped></style>
