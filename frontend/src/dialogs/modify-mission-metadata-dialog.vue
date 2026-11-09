<template>
    <base-dialog ref="dialogRef">
        <template #title> Modify Metadata</template>
        <template #content>
            <select-mission-metadata
                v-if="mission?.project?.uuid"
                :project-uuid="mission.project.uuid"
                :metadata-values="metadataValues"
                @update:metadata-values="updateMetadataValues"
            />
        </template>
        <template #actions>
            <q-btn
                class="bg-button-primary"
                label="Save"
                :disable="metadataValues === undefined"
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
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { updateMissionMetadata } from 'src/services/mutations/mission';
import { ref, Ref, watch } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const properties = defineProps<{
    mission?: MissionWithFilesDto;
}>();

const queryClient = useQueryClient();

const metadataValues: Ref<Record<string, string>> = ref({});
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
        }
    },
    { immediate: true },
);

const { mutate: mutateMissionMetadata } = useMutation({
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
});

const saveMetadata = (): void => {
    mutateMissionMetadata();
};

const updateMetadataValues = (update: Record<string, string>): void => {
    metadataValues.value = update;
};
</script>
<style scoped></style>
