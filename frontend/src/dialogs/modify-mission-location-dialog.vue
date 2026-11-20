<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="moving"
        :submit-disabled="alreadyThere || moving"
        @submit="onOk"
    >
        <template #title>Move Mission</template>
        <template #subtitle>{{ mission?.name }}</template>

        <template #content>
            <q-form ref="formReference" greedy @submit.prevent>
                <ScopeSelector
                    v-model:project-uuid="selectedProjectUuid"
                    :show-mission="false"
                    :required="true"
                />
            </q-form>
        </template>

        <template #actions>
            <span class="disabled-reason">
                <q-btn
                    flat
                    no-caps
                    label="Move Mission"
                    class="bg-button-primary"
                    :disable="alreadyThere"
                    :loading="moving"
                    @click="onOk"
                />
                <q-tooltip v-if="alreadyThere"
                    >Already in this project</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import { useQueryClient } from '@tanstack/vue-query';
import ScopeSelector from 'components/common/scope-selector.vue';
import { Notify, QForm, useDialogPluginComponent } from 'quasar';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { getDialogErrorMessage } from 'src/services/error-handling';
import { moveMission } from 'src/services/mutations/mission';
import { computed, ref } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const properties = defineProps<{
    mission?: MissionWithFilesDto;
}>();

const queryClient = useQueryClient();

const selectedProjectUuid = ref<string | undefined>(
    properties.mission?.project.uuid,
);

const { selectedProject } = useScopeSelection(selectedProjectUuid);

const moving = ref(false);
const errorMessage = ref('');
const alreadyThere = computed(
    () => selectedProjectUuid.value === properties.mission?.project.uuid,
);
const formReference = ref<QForm>();

async function onOk(): Promise<void> {
    if (!properties.mission || alreadyThere.value || moving.value) {
        return;
    }
    if (!(await formReference.value?.validate(true))) return;
    if (!selectedProjectUuid.value || !selectedProject.value) return;

    const targetProjectUuid = selectedProjectUuid.value;
    moving.value = true;
    errorMessage.value = '';
    try {
        await moveMission(properties.mission.uuid, targetProjectUuid);
    } catch (error: unknown) {
        errorMessage.value = getDialogErrorMessage(error);
        return;
    } finally {
        moving.value = false;
    }

    Notify.create({
        message: `Mission ${properties.mission.name} moved to project ${selectedProject.value.name}`,
        color: 'positive',
        timeout: 4000,
        position: 'bottom',
    });
    onDialogOK(targetProjectUuid);

    // refresh the mission and project lists
    await queryClient.invalidateQueries({
        predicate: (query) =>
            query.queryKey[0] === 'missions' ||
            query.queryKey[0] === 'projects',
    });
}
</script>
