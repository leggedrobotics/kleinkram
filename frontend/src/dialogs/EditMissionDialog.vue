<template>
    <base-dialog ref="dialogRef">
        <template #title> Edit Mission</template>

        <template #content>
            <q-input
                ref="missionNameInput"
                v-model="missionName"
                name="missionName"
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
import { ref } from 'vue';
import { updateMissionName } from 'src/services/mutations/mission';
import { useQueryClient } from '@tanstack/vue-query';
import { MissionDto } from '@api/types/Mission.dto';

const { dialogRef } = useDialogPluginComponent();
const $q = useQuasar();
const queryClient = useQueryClient();
const isNameValid = ref(true);

const properties = defineProps<{
    mission: MissionDto;
}>();

const missionName = ref(properties.mission.name);

const saveMissionName = async () => {
    await updateMissionName(properties.mission.uuid, missionName.value)
        .then(async () => {
            $q.notify({
                message: 'Mission name updated',
                color: 'positive',
            });

            // clear mission and missions cache
            // to force a refetch of the missions
            await queryClient.invalidateQueries({
                queryKey: ['project', properties.mission.project.uuid],
            });
            await queryClient.invalidateQueries({
                queryKey: ['missions'],
            });
            await queryClient.invalidateQueries({
                queryKey: ['mission', properties.mission.uuid],
            });
            dialogRef.value?.hide();
        })
        .catch(() => {
            isNameValid.value = false;
        });
};
</script>
<style scoped></style>
