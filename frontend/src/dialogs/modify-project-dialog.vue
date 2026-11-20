<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="saving"
        :dirty="dirty"
        :submit-disabled="saving"
        @submit="saveProject"
    >
        <template #title>Edit Project</template>

        <template #content>
            <q-form v-if="project" ref="formReference" greedy @submit.prevent>
                <label :for="nameId">
                    Name<span class="text-error">*</span>
                </label>
                <NameField
                    :id="nameId"
                    v-model="projectName"
                    label="Project name"
                    autofocus
                    :accepted="project.name"
                    :server-error="serverNameError"
                    @edit="clearServerNameError"
                />

                <label :for="descriptionId">
                    Description<span class="text-error">*</span>
                </label>
                <q-input
                    v-model="projectDescription"
                    :for="descriptionId"
                    name="projectDescription"
                    type="textarea"
                    outlined
                    dense
                    no-error-icon
                    lazy-rules
                    color="button-primary"
                    :rules="[required('Project description')]"
                />

                <q-toggle
                    v-model="autoConvert"
                    name="autoConvert"
                    label="Auto-convert to mcap"
                    color="button-primary"
                    dense
                />
                <p class="text-secondary q-mt-sm q-mb-none">
                    Auto-convert has
                    <a
                        href="https://github.com/leggedrobotics/kleinkram/issues/1250"
                        target="_blank"
                        rel="noopener"
                        >known limitations</a
                    >.
                </p>
            </q-form>
            <q-spinner v-else />
        </template>

        <template #actions>
            <q-btn
                flat
                no-caps
                label="Save Project"
                class="bg-button-primary"
                :loading="saving"
                @click="saveProject"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { ProjectWithRequiredMetadataTypesDto } from '@kleinkram/api-dto/types/project/project-with-required-metadata-types.dto';
import { useQueryClient } from '@tanstack/vue-query';
import NameField from 'components/common/name-field.vue';
import { Notify, QForm, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useProjectQuery } from 'src/hooks/query-hooks';
import {
    focusField,
    getDialogErrorMessage,
    getErrorMessage,
    isNameError,
} from 'src/services/error-handling';
import { required } from 'src/services/form-rules';
import { updateProject } from 'src/services/mutations/project';
import { computed, ref, useId, watch } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { projectUuid } = defineProps<{
    projectUuid: string;
}>();

// verify that the projectUuid is not empty
if (projectUuid === '') throw new Error('Project UUID is required');

const queryClient = useQueryClient();
const nameId = `edit-project-name-${useId()}`;
const descriptionId = `edit-project-description-${useId()}`;

const projectName = ref('');
const autoConvert = ref(true);
const projectDescription = ref('');
const saving = ref(false);
const errorMessage = ref('');
// the server rejected the name, e.g. it is already taken
const serverNameError = ref('');
const clearServerNameError = (): void => {
    serverNameError.value = '';
};

const { data: project } = useProjectQuery(computed(() => projectUuid));

watch(
    () => project.value,
    (newValue: ProjectWithRequiredMetadataTypesDto | undefined) => {
        if (newValue) {
            projectName.value = newValue.name;
            projectDescription.value = newValue.description;
            autoConvert.value = newValue.autoConvert;
        }
    },
    { immediate: true },
);

const dirty = computed(
    () =>
        !!project.value &&
        (projectName.value !== project.value.name ||
            projectDescription.value !== project.value.description ||
            autoConvert.value !== project.value.autoConvert),
);

const formReference = ref<QForm>();

async function saveProject(): Promise<void> {
    if (!project.value || saving.value) return;
    if (!(await formReference.value?.validate(true))) return;
    // nothing changed: nothing to save
    if (!dirty.value) {
        onDialogOK();
        return;
    }

    saving.value = true;
    errorMessage.value = '';
    try {
        await updateProject(
            project.value.uuid,
            projectName.value.trim(),
            projectDescription.value,
            autoConvert.value,
        );
    } catch (error: unknown) {
        if (isNameError(error)) {
            // e.g. the name is already taken: shown on the name field
            serverNameError.value = getErrorMessage(error);
            focusField(nameId);
        } else {
            errorMessage.value = getDialogErrorMessage(error);
        }
        return;
    } finally {
        saving.value = false;
    }

    Notify.create({
        message: 'Project updated successfully',
        color: 'positive',
        position: 'bottom',
        timeout: 2000,
    });
    onDialogOK();

    await queryClient.invalidateQueries({
        predicate: (query) =>
            query.queryKey[0] === 'projects' || query.queryKey[0] === 'project',
    });
}
</script>
