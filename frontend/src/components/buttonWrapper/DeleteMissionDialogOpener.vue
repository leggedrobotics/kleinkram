<template>
    <div @click="deleteFile">
        <slot />
    </div>
</template>
<script setup lang="ts">
import { useQuasar } from 'quasar';
import DeleteMissionDialog from 'src/dialogs/DeleteMissionDialog.vue';
import { Mission } from 'src/types/Mission';

const props = defineProps<{
    mission: Mission;
}>();

const $q = useQuasar();

const deleteFile = () =>
    $q.dialog({
        title: 'Delete File',
        component: DeleteMissionDialog,
        componentProps: {
            mission: props.mission,
        },
    });
</script>

<style scoped></style>
