<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="saving"
        :dirty="dirty"
        :submit-disabled="saving"
        @submit="saveMissionName"
    >
        <template #title>Edit Mission</template>

        <template #content>
            <q-form ref="formReference" greedy @submit.prevent>
                <label :for="nameId">
                    Name<span class="text-error">*</span>
                </label>
                <NameField
                    :id="nameId"
                    v-model="missionName"
                    label="Mission name"
                    autofocus
                    :accepted="mission.name"
                    :server-error="serverErrorMessage"
                    @edit="onMissionNameUpdate"
                />
            </q-form>
        </template>

        <template #actions>
            <q-btn
                flat
                no-caps
                label="Save Mission"
                class="bg-button-primary"
                :loading="saving"
                @click="saveMissionName"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import { useQueryClient } from '@tanstack/vue-query';
import NameField from 'components/common/name-field.vue';
import { QForm, useDialogPluginComponent, useQuasar } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import {
    focusField,
    getDialogErrorMessage,
    getErrorMessage,
    isNameError,
} from 'src/services/error-handling';
import { updateMissionName } from 'src/services/mutations/mission';
import { computed, ref, useId } from 'vue';

const DEFAULT_NAME_ERROR = 'Please enter a valid mission name';

const { dialogRef } = useDialogPluginComponent();
const $q = useQuasar();
const queryClient = useQueryClient();
// error returned by the server for a rejected name
const serverErrorMessage = ref('');

const properties = defineProps<{
    mission: MissionWithFilesDto;
}>();

const missionName = ref(properties.mission.name);
const formReference = ref<QForm>();

const onMissionNameUpdate = (): void => {
    serverErrorMessage.value = '';
};

const nameId = `edit-mission-name-${useId()}`;
const saving = ref(false);
// a failure that is not about the name itself
const errorMessage = ref('');
const dirty = computed(() => missionName.value !== properties.mission.name);

const saveMissionName = async (): Promise<void> => {
    if (saving.value) return;
    if (!(await formReference.value?.validate(true))) return;
    // nothing changed: nothing to save
    if (!dirty.value) {
        dialogRef.value?.hide();
        return;
    }
    serverErrorMessage.value = '';
    errorMessage.value = '';
    saving.value = true;
    try {
        await updateMissionName(properties.mission.uuid, missionName.value);
    } catch (error: unknown) {
        // a rejected or taken name is shown on the name field, every other
        // failure (missing rights, no connection, ...) in the error strip
        if (isNameError(error)) {
            serverErrorMessage.value = getErrorMessage(
                error,
                DEFAULT_NAME_ERROR,
            );
            focusField(nameId);
        } else {
            errorMessage.value = getDialogErrorMessage(error);
        }
        return;
    } finally {
        saving.value = false;
    }

    $q.notify({
        message: 'Mission name updated',
        color: 'positive',
    });
    dialogRef.value?.hide();

    // clear mission and missions cache to force a refetch of the missions
    await queryClient.invalidateQueries({
        queryKey: ['project', properties.mission.project.uuid],
    });
    await queryClient.invalidateQueries({
        queryKey: ['missions'],
    });
    await queryClient.invalidateQueries({
        queryKey: ['mission', properties.mission.uuid],
    });
};
</script>
