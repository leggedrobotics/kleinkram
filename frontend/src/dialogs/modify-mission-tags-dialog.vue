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
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import { DataType } from '@kleinkram/shared';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import SelectMissionTags from 'components/select-mission-tags.vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { updateMissionTags } from 'src/services/mutations/mission';
import { ref, Ref, watch } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const properties = defineProps<{
    mission?: MissionWithFilesDto;
}>();

const queryClient = useQueryClient();

const tagValues: Ref<Record<string, string>> = ref({});
watch(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    () => properties.mission,
    (newMission) => {
        if (newMission) {
            tagValues.value = {};
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            for (const tag of newMission.tags) {
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                tagValues.value[tag.type.uuid] =
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    tag.type.datatype === DataType.BOOLEAN
                        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                          tag.value
                        : // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                          tag.valueAsString;
            }
        }
    },
    { immediate: true },
);

const { mutate: _updateMissionTags } = useMutation({
    mutationFn: () => {
        return updateMissionTags(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
