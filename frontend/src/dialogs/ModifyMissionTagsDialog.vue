<template>
    <base-dialog ref="dialogRef">
        <template #title> Modify Tags </template>
        <template #content>
            <SelectMissionTags
                :project-u-u-i-d="mission?.project?.uuid"
                :tag-values="tagValues"
                @update:tag-values="(update) => (tagValues = update)"
            />
        </template>
        <template #actions>
            <q-btn
                class="bg-button-primary"
                label="Save"
                :disable="tagValues === {}"
                @click="modifyTags"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import SelectMissionTags from 'components/SelectMissionTags.vue';
import { ref, Ref, watch } from 'vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { updateMissionTags } from 'src/services/mutations/mission';
import { DataType } from '@common/enum';
import { MissionDto } from '@api/types/Mission.dto';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    mission?: MissionDto;
}>();

const queryClient = useQueryClient();

const tagValues: Ref<Record<string, string>> = ref({});
watch(
    () => props.mission,
    (newMission) => {
        if (newMission) {
            tagValues.value = {};
            newMission.tags.tags.forEach((tag) => {
                if (tag.type.datatype === DataType.BOOLEAN) {
                    tagValues.value[tag.type.datatype] = tag.BOOLEAN;
                } else {
                    tagValues.value[tag.type.uuid] = tag.valueAsString;
                }
            });
        }
    },
    { immediate: true },
);
const { mutate: _updateMissionTags } = useMutation({
    mutationFn: () => {
        return updateMissionTags(props.mission?.uuid, tagValues.value);
    },
    onSuccess: async () => {
        Notify.create({
            message: 'Tags updated',
            color: 'positive',
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            queryKey: ['mission', props.mission?.uuid],
        });
        await queryClient.invalidateQueries({
            queryKey: ['missions'],
        });
        onDialogOK();
    },
});

function modifyTags() {
    _updateMissionTags();
}
</script>
<style scoped></style>
