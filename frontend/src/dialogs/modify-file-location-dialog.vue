<template>
    <base-dialog ref="dialogRef">
        <template #title>
            Move File{{ files.length === 1 ? ' ' + files[0]?.filename : 's' }}
        </template>

        <template #content>
            <div class="q-mt-md">
                <ScopeSelector
                    v-model:project-uuid="targetProjectUuid"
                    v-model:mission-uuid="targetMissionUuid"
                    layout="column"
                    :required="true"
                />
            </div>
        </template>
        <template #actions>
            <q-btn
                label="Cancel"
                flat
                class="q-mr-sm button-border"
                @click="onDialogCancel"
            />
            <q-btn
                label="Save"
                class="bg-button-primary"
                :loading="isPending"
                :disable="!targetMissionUuid || isPending"
                @click="saveAction"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, useDialogPluginComponent } from 'quasar';
import { ref } from 'vue';

// API Types
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission.dto';

// Components & Services
import ScopeSelector from 'components/common/scope-selector.vue';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { moveFiles } from 'src/services/mutations/file';

const props = defineProps<{
    mission: MissionWithFilesDto;
    files: FileWithTopicDto[];
}>();

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const queryClient = useQueryClient();

// State: Initialize with the current location of the file(s)
const targetProjectUuid = ref<string | undefined>(props.mission.project.uuid);
const targetMissionUuid = ref<string | undefined>(props.mission.uuid);

const { mutate: moveFilesMutation, isPending } = useMutation({
    mutationFn: () => {
        if (!targetMissionUuid.value) {
            throw new Error('No mission selected');
        }
        return moveFiles(
            props.files.map((f) => f.uuid),
            targetMissionUuid.value,
        );
    },
    onSuccess: async () => {
        Notify.create({
            group: false,
            message: 'Files moved',
            color: 'positive',
            spinner: false,
            position: 'bottom',
            timeout: 3000,
        });

        await queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'files' ||
                query.queryKey[0] === 'missions',
        });

        onDialogOK();
    },
    onError(error: unknown) {
        console.error(error);
        const message =
            (error as { response?: { data?: { message?: string } } })?.response
                ?.data?.message || 'Unknown error occurred';

        Notify.create({
            group: false,
            message: `Error moving file: ${message}`,
            color: 'negative',
            spinner: false,
            position: 'bottom',
            timeout: 3000,
        });
    },
});

const saveAction = (): void => {
    moveFilesMutation();
};
</script>

<style scoped></style>
