<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="deleting"
        size="sm"
        :submit-disabled="!confirmed || deleting"
        @submit="deleteProjectAction"
    >
        <template #title>Delete Project</template>
        <template #content>
            <template v-if="project">
                <label :for="inputId" class="confirm-label">
                    Type <b>{{ project.name }}</b> to confirm. This can't be
                    undone.
                </label>
                <q-input
                    v-model="projectNameCheck"
                    no-error-icon
                    :for="inputId"
                    outlined
                    dense
                    autofocus
                    autocomplete="off"
                />
            </template>
            <q-skeleton v-else height="64px" />
        </template>

        <template #actions>
            <span class="disabled-reason">
                <q-btn
                    flat
                    no-caps
                    :disable="!confirmed"
                    :loading="deleting"
                    label="Delete Project"
                    class="bg-button-danger"
                    @click="deleteProjectAction"
                />
                <q-tooltip v-if="!confirmed"
                    >Type the name to confirm</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useHandler, useProjectQuery } from 'src/hooks/query-hooks';
import { getDialogErrorMessage } from 'src/services/error-handling';
import { deleteProject } from 'src/services/mutations/project';
import { computed, ref, useId } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { projectUuid } = defineProps<{
    projectUuid: string;
}>();

const { data: project } = useProjectQuery(computed(() => projectUuid));
const client = useQueryClient();
const handler = useHandler();

const inputId = `delete-project-${useId()}`;
const projectNameCheck = ref('');
const deleting = ref(false);
const errorMessage = ref('');
const confirmed = computed(
    () => !!project.value && projectNameCheck.value === project.value.name,
);

async function deleteProjectAction(): Promise<void> {
    if (!confirmed.value || deleting.value) return;
    deleting.value = true;
    errorMessage.value = '';
    try {
        await deleteProject(projectUuid);
    } catch (error: unknown) {
        errorMessage.value = getDialogErrorMessage(error);
        return;
    } finally {
        deleting.value = false;
    }

    Notify.create({
        message: 'Project deleted',
        color: 'positive',
        timeout: 2000,
        position: 'bottom',
    });
    onDialogOK();
    handler.value.setProjectUUID('');

    await client.invalidateQueries({
        predicate: (query) =>
            query.queryKey[0] === 'projects' ||
            (query.queryKey[0] === 'project' &&
                query.queryKey[1] === projectUuid),
    });
}
</script>

<style scoped>
.confirm-label {
    display: block;
    margin-bottom: 4px;
    overflow-wrap: anywhere;
}
</style>
