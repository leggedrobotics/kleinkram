<template>
    <base-dialog ref="dialogRef">
        <template #title> Edit Mission</template>

        <template #content>
            <q-input
                name="missionName"
                ref="missionNameInput"
                v-model="missionName"
                outlined
                autofocus
                style="padding-bottom: 30px"
                :error="!isNameValid"
                :error-message="'Please enter a valid mission name'"
                placeholder="Name..."
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Save Mission"
                class="bg-button-primary"
                @click="saveMissionName"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { QInput, useDialogPluginComponent, useQuasar } from 'quasar';
import { Mission } from 'src/types/Mission';
import { ref } from 'vue';
import { updateMissionName } from 'src/services/mutations/mission';
import { useQueryClient } from '@tanstack/vue-query';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const $q = useQuasar();
const queryClient = useQueryClient();
const isNameValid = ref(true);

const props = defineProps<{
    mission: Mission;
}>();

const missionName = ref(props.mission.name);

const saveMissionName = async () => {
    await updateMissionName(props.mission.uuid, missionName.value)
        .then(() => {
            $q.notify({
                message: 'Mission name updated',
                color: 'positive',
            });

            // clear mission and missions cache
            // to force a refetch of the missions
            queryClient.invalidateQueries({
                queryKey: ['project', props.mission.project.uuid],
            });
            queryClient.invalidateQueries({
                queryKey: ['missions'],
            });
            queryClient.invalidateQueries({
                queryKey: ['mission', props.mission.uuid],
            });
            dialogRef.value?.hide();
        })
        .catch(() => {
            isNameValid.value = false;
        });
};
</script>
<style scoped></style>
