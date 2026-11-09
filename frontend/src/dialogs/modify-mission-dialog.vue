<template>
    <base-dialog ref="dialogRef">
        <template #title> Edit Mission </template>

        <template #content>
            <q-input
                ref="missionNameInput"
                v-model="missionName"
                name="missionName"
                outlined
                autofocus
                style="padding-bottom: 30px"
                :error="!isNameValid"
                :error-message="nameErrorMessage"
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
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import { useQueryClient } from '@tanstack/vue-query';
import { QInput, useDialogPluginComponent, useQuasar } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { getErrorMessage, getErrorStatus } from 'src/services/error-handling';
import { updateMissionName } from 'src/services/mutations/mission';
import { ref } from 'vue';

const DEFAULT_NAME_ERROR = 'Please enter a valid mission name';

const { dialogRef } = useDialogPluginComponent();
const $q = useQuasar();
const queryClient = useQueryClient();
const isNameValid = ref(true);
const nameErrorMessage = ref(DEFAULT_NAME_ERROR);

const properties = defineProps<{
    mission: MissionWithFilesDto;
}>();

const missionName = ref(properties.mission.name);

const saveMissionName = async () => {
    isNameValid.value = true;
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
        .catch((error: unknown) => {
            // only a rejected name is reported on the input itself, every other
            // failure (missing rights, name already taken, ...) is shown as a
            // notification to not mislabel it as an invalid name
            if (getErrorStatus(error) !== 400) {
                $q.notify({
                    message: `Failed to update mission name: ${getErrorMessage(error)}`,
                    color: 'negative',
                });
                return;
            }

            nameErrorMessage.value = getErrorMessage(error, DEFAULT_NAME_ERROR);
            isNameValid.value = false;
        });
};
</script>
<style scoped></style>
