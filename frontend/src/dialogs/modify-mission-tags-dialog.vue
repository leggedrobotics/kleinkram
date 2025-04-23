<template>
    <base-dialog ref="dialogRef">
        <template #title> Modify Metadata</template>
        <template #content>
            <select-mission-tags
                v-if="mission?.project?.uuid"
                :project-uuid="mission.project.uuid"
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
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { ref, Ref, watch } from 'vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { updateMissionTags } from 'src/services/mutations/mission';
import { DataType } from '@common/enum';
import { MissionWithFilesDto } from '@api/types/mission/mission.dto';
import SelectMissionTags from 'components/select-mission-tags.vue';

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
                // @ts-ignore
                tagValues.value[tag.type.uuid] =
                    tag.type.datatype === DataType.BOOLEAN
                        ? tag.value
                        : tag.valueAsString;
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
