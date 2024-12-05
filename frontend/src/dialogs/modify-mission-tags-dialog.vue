<template>
    <base-dialog ref="dialogRef">
        <template #title> Modify Tags </template>
        <template #content>
            <select-mission-tags
                :project-uuid="mission?.project?.uuid"
                :tag-values="tagValues"
                @update:tag-values="updateTagValue"
            />
        </template>
        <template #actions>
            <q-btn
                class="bg-button-primary"
                label="Save"
                :disable="tagValues === undefined"
                @click="modifyTags"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import BaseDialog from './base-dialog.vue';
import { ref, Ref, watch } from 'vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { updateMissionTags } from 'src/services/mutations/mission';
import { DataType } from '@common/enum';
import { MissionWithFilesDto } from '@api/types/Mission.dto';
import SelectMissionTags from '../components/SelectMissionTags.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const properties = defineProps<{
    mission?: MissionWithFilesDto;
}>();

const queryClient = useQueryClient();

const tagValues: Ref<Record<string, string>> = ref({});
watch(
    () => properties.mission,
    (newMission) => {
        if (newMission) {
            tagValues.value = {};
            for (const tag of newMission.tags) {
                if (tag.type.datatype === DataType.BOOLEAN) {
                    // @ts-ignore
                    tagValues.value[tag.type.datatype] = TagType.BOOLEAN;
                } else {
                    tagValues.value[tag.type.uuid] = tag.valueAsString;
                }
            }
        }
    },
    { immediate: true },
);
const { mutate: _updateMissionTags } = useMutation({
    mutationFn: () => {
        return updateMissionTags(
            properties.mission?.uuid ?? '',
            tagValues.value,
        );
    },
    onSuccess: async () => {
        Notify.create({
            message: 'Tags updated',
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

const modifyTags = (): void => {
    _updateMissionTags();
};

const updateTagValue = (update: Record<string, string>): void => {
    tagValues.value = update;
};
</script>
<style scoped></style>
