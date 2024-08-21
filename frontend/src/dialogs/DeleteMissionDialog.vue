<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete Mission</template>
        <template #content>
            <delete-mission :mission="mission" @deleted="onDialogCancel" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Delete Mission"
                class="bg-button-primary"
                @click="onDialogCancel"
            />
        </template>
    </base-dialog>
    >
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import { Mission } from 'src/types/Mission';
import DeleteMission from 'components/DeleteMission.vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const { dialogRef, onDialogCancel } = useDialogPluginComponent();

const props = defineProps<{
    mission: Mission;
}>();
</script>
<style scoped></style>
