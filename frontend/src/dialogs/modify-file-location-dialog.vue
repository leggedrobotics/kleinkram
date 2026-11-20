<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="isPending"
        :dirty="dirty"
        :submit-disabled="alreadyThere || isPending"
        @submit="saveAction"
    >
        <template #title>{{ actionLabel }}</template>
        <template v-if="files.length === 1" #subtitle>
            {{ files[0]?.filename }}
        </template>

        <template #content>
            <q-form ref="formReference" greedy @submit.prevent>
                <ScopeSelector
                    v-model:project-uuid="targetProjectUuid"
                    v-model:mission-uuid="targetMissionUuid"
                    layout="column"
                    :required="true"
                />
            </q-form>
        </template>
        <template #actions>
            <span class="disabled-reason">
                <q-btn
                    flat
                    no-caps
                    :label="files.length === 1 ? 'Move File' : 'Move Files'"
                    class="bg-button-primary"
                    :loading="isPending"
                    :disable="alreadyThere"
                    @click="saveAction"
                />
                <q-tooltip v-if="alreadyThere"
                    >Already in this mission</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, QForm, useDialogPluginComponent } from 'quasar';
import { getDialogErrorMessage } from 'src/services/error-handling';
import { computed, ref } from 'vue';

// API Types
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';

// Components & Services
import ScopeSelector from 'components/common/scope-selector.vue';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { moveFiles } from 'src/services/mutations/file';

const props = defineProps<{
    mission: MissionWithFilesDto;
    files: FileWithTopicDto[];
}>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const queryClient = useQueryClient();

// State: Initialize with the current location of the file(s)
const targetProjectUuid = ref<string | undefined>(props.mission.project.uuid);
const targetMissionUuid = ref<string | undefined>(props.mission.uuid);

const errorMessage = ref('');
const actionLabel = computed(() =>
    props.files.length === 1
        ? 'Move File'
        : `Move ${String(props.files.length)} Files`,
);
const dirty = computed(() => targetMissionUuid.value !== props.mission.uuid);
const alreadyThere = computed(
    () => targetMissionUuid.value === props.mission.uuid,
);
const formReference = ref<QForm>();

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
        errorMessage.value = getDialogErrorMessage(error);
    },
});

const saveAction = async (): Promise<void> => {
    if (alreadyThere.value || isPending.value) return;
    if (!(await formReference.value?.validate(true))) return;
    errorMessage.value = '';
    moveFilesMutation();
};
</script>

<style scoped></style>
