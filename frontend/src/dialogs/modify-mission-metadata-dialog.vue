<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="isPending"
        :dirty="dirty"
        :submit-disabled="isPending"
        @submit="saveMetadata"
    >
        <template #title>Edit Metadata</template>
        <template #content>
            <q-form ref="formReference" greedy @submit.prevent>
                <select-mission-metadata
                    v-if="mission?.project?.uuid"
                    v-model:server-errors="serverErrors"
                    :project-uuid="mission.project.uuid"
                    :metadata-values="metadataValues"
                    @update:metadata-values="updateMetadataValues"
                />
            </q-form>
        </template>
        <template #actions>
            <q-btn
                flat
                no-caps
                class="bg-button-primary"
                label="Save Metadata"
                :loading="isPending"
                @click="saveMetadata"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import { DataType } from '@kleinkram/shared';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import SelectMissionMetadata from 'components/select-mission-metadata.vue';
import { Notify, QForm, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import {
    getDialogErrorMessage,
    getFieldErrors,
} from 'src/services/error-handling';
import { updateMissionMetadata } from 'src/services/mutations/mission';
import { computed, ref, Ref, watch } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const properties = defineProps<{
    mission?: MissionWithFilesDto;
}>();

const queryClient = useQueryClient();

const metadataValues: Ref<Record<string, string>> = ref({});
const initialValues = ref('');
const errorMessage = ref('');
// errors the server reported per metadata type uuid
const serverErrors = ref<Record<string, string>>({});
const formReference = ref<QForm>();
const dirty = computed(
    () => JSON.stringify(metadataValues.value) !== initialValues.value,
);
watch(
    () => properties.mission,
    (newMission) => {
        if (newMission) {
            metadataValues.value = {};

            for (const metadata of newMission.metadata) {
                const value = metadata.value;
                if (metadata.type.datatype === DataType.BOOLEAN) {
                    metadataValues.value[metadata.type.uuid] =
                        value as unknown as string;
                } else {
                    const rawValue = value as
                        string | Date | number | boolean | null | undefined;
                    metadataValues.value[metadata.type.uuid] =
                        rawValue !== undefined && rawValue !== null
                            ? String(rawValue)
                            : '';
                }
            }
            initialValues.value = JSON.stringify(metadataValues.value);
        }
    },
    { immediate: true },
);

const { mutate: mutateMissionMetadata, isPending } = useMutation({
    mutationFn: () => {
        return updateMissionMetadata(
            properties.mission?.uuid ?? '',
            metadataValues.value,
        );
    },
    onSuccess: async () => {
        Notify.create({
            message: 'Metadata updated',
            color: 'positive',
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            queryKey: ['mission', properties.mission?.uuid],
        });
        await queryClient.invalidateQueries({
            queryKey: ['missions'],
        });
        onDialogOK();
    },
    onError: (error: unknown) => {
        const fieldErrors = getFieldErrors(error);
        if (fieldErrors) {
            // shown on the metadata fields they belong to
            serverErrors.value = fieldErrors;
            return;
        }
        errorMessage.value = getDialogErrorMessage(error);
    },
});

const saveMetadata = async (): Promise<void> => {
    if (isPending.value) return;
    if (!(await formReference.value?.validate(true))) return;
    errorMessage.value = '';
    mutateMissionMetadata();
};

const updateMetadataValues = (update: Record<string, string>): void => {
    metadataValues.value = update;
};
</script>
<style scoped></style>
