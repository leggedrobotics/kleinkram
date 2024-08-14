<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 500px"
        >
            <delete-mission :mission="mission" @deleted="onDialogCancel" />
        </q-card>
    </q-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import { Mission } from 'src/types/Mission';
import DeleteMission from 'components/DeleteMission.vue';

const { dialogRef, onDialogCancel } = useDialogPluginComponent();

const props = defineProps<{
    mission: Mission;
}>();
</script>
<style scoped></style>
