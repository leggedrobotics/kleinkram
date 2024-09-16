<template>
    <base-dialog ref="dialogRef">
        <template #title>Modify Tags</template>
        <template #content>
            <SelectMissionTags
                :projectUUID="mission?.project?.uuid"
                :tag-values="tagValues"
                @update:tagValues="(update) => (tagValues = update)"
            />
        </template>
        <template #actions>
            <q-btn
                label="Save"
                color="primary"
                @click="modifyTags"
                :disable="tagValues === {}"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import SelectMissionTags from 'components/SelectMissionTags.vue';
import { Mission } from 'src/types/Mission';
import { ref, Ref, watch } from 'vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { updateMissionTags } from 'src/services/mutations/mission';
import { DataType } from 'src/enums/TAG_TYPES';
const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    mission?: Mission;
}>();

const queryClient = useQueryClient();

const tagValues: Ref<Record<string, string>> = ref({});
watch(
    () => props.mission,
    (newMission) => {
        if (newMission) {
            tagValues.value = {};
            newMission.tags.forEach((tag) => {
                if (tag.type.type === DataType.BOOLEAN) {
                    tagValues.value[tag.type.uuid] = tag.BOOLEAN;
                } else {
                    tagValues.value[tag.type.uuid] = tag.asString();
                }
            });
        }
    },
    { immediate: true },
);
const { mutate: _updateMissionTags } = useMutation({
    mutationFn: () => {
        return updateMissionTags(props.mission.uuid, tagValues.value);
    },
    onSuccess: () => {
        Notify.create({
            message: 'Tags updated',
            color: 'positive',
            position: 'bottom',
        });
        queryClient.invalidateQueries({
            queryKey: ['mission', props.mission.uuid],
        });
        queryClient.invalidateQueries({
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
