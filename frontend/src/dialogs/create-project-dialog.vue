<template>
    <BaseDialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="creating"
        fixed-height
        size="lg"
        :dirty="dirty"
        :submit-disabled="creating"
        @submit="onSubmit"
    >
        <template #title>New Project</template>

        <template #tabs>
            <q-tabs
                v-model="tab"
                dense
                align="left"
                active-color="button-primary"
                indicator-color="button-primary"
            >
                <q-tab name="details" label="Details" />
                <q-tab
                    name="metadata"
                    label="Required Metadata"
                    :disable="!formIsValid"
                />
                <q-tab
                    name="manage_access"
                    label="Access"
                    :disable="!formIsValid"
                />
            </q-tabs>
        </template>

        <template #content>
            <div class="dialog-tab-panels">
                <div
                    role="tabpanel"
                    class="dialog-tab-panel"
                    :class="{ 'dialog-tab-panel--active': tab === 'details' }"
                    :inert="tab !== 'details'"
                >
                    <q-form ref="formReference" greedy @submit.prevent>
                        <label :for="nameId">
                            Name<span class="text-error">*</span>
                        </label>
                        <NameField
                            :id="nameId"
                            v-model="newProjectName"
                            label="Project name"
                            autofocus
                            :server-error="serverNameError"
                            @edit="onNameUpdate"
                        />

                        <label :for="descriptionId">
                            Description<span class="text-error">*</span>
                        </label>
                        <q-input
                            v-model="newProjectDescription"
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
                    </q-form>
                </div>

                <div
                    role="tabpanel"
                    class="dialog-tab-panel"
                    :class="{ 'dialog-tab-panel--active': tab === 'metadata' }"
                    :inert="tab !== 'metadata'"
                >
                    <ConfigureMetadata v-model:selected="selected" />
                </div>

                <div
                    role="tabpanel"
                    class="dialog-tab-panel"
                    :class="{
                        'dialog-tab-panel--active': tab === 'manage_access',
                    }"
                    :inert="tab !== 'manage_access'"
                >
                    <access-rights-manager v-model="accessGroups" />
                </div>
            </div>
        </template>
        <template #actions>
            <q-btn
                v-if="tab === 'manage_access'"
                flat
                no-caps
                label="Create Project"
                class="bg-button-primary"
                :loading="creating"
                @click="submitNewProject"
            />
            <q-btn
                v-else
                flat
                no-caps
                label="Next"
                class="bg-button-primary"
                @click="nextTab"
            />
        </template>
    </BaseDialog>
</template>

<script setup lang="ts">
import BaseDialog from 'src/dialogs/base-dialog.vue';

import type { DefaultRightDto } from '@kleinkram/api-dto/types/access-control/default-right.dto';
import type { MetadataTypeDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import { getNameValidationError } from '@kleinkram/validation/frontend';
import { useQueryClient } from '@tanstack/vue-query';
import NameField from 'components/common/name-field.vue';
import AccessRightsManager from 'components/configure-access-rights/access-rights-manager.vue';
import ConfigureMetadata from 'components/configure-metadata.vue';
import { QForm, useDialogPluginComponent, useQuasar } from 'quasar';
import { useProjectDefaultAccess } from 'src/hooks/query-hooks';
import {
    focusField,
    getDialogErrorMessage,
    getErrorMessage,
    isNameError,
} from 'src/services/error-handling';
import { required } from 'src/services/form-rules';
import { createProject } from 'src/services/mutations/project';
import { computed, nextTick, Ref, ref, useId, watch } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const queryClient = useQueryClient();
const $q = useQuasar();

const nameId = `new-project-name-${useId()}`;
const descriptionId = `new-project-description-${useId()}`;

const newProjectName = ref('');
const newProjectDescription = ref('');
const formReference = ref<QForm>();
// error returned by the server for a rejected name
const serverNameError = ref('');
const errorMessage = ref('');
const creating = ref(false);

const tab = ref('details');

const selected: Ref<MetadataTypeDto[]> = ref([]);

const { data: defaultRights } = useProjectDefaultAccess();

const accessGroups = ref<DefaultRightDto[]>(defaultRights.value?.data ?? []);
watch(defaultRights, () => {
    accessGroups.value = defaultRights.value?.data ?? [];
});

// whether the other tabs can be opened; the fields show their own errors
const formIsValid = computed(
    () =>
        !serverNameError.value &&
        getNameValidationError(newProjectName.value) === undefined &&
        !!newProjectDescription.value.trim(),
);

const dirty = computed(
    () =>
        newProjectName.value !== '' ||
        newProjectDescription.value !== '' ||
        selected.value.length > 0 ||
        JSON.stringify(accessGroups.value) !==
            JSON.stringify(defaultRights.value?.data ?? []),
);

const onNameUpdate = (): void => {
    serverNameError.value = '';
};

/** Validates the details; shows them with the first invalid field focused */
async function validateDetails(): Promise<boolean> {
    if (formIsValid.value) return true;
    tab.value = 'details';
    await nextTick();
    await formReference.value?.validate(true);
    return false;
}

const nextTab = async (): Promise<void> => {
    if (!(await validateDetails())) return;
    if (tab.value === 'details') {
        tab.value = 'metadata';
    } else if (tab.value === 'metadata') {
        tab.value = 'manage_access';
    }
};

/** Enter moves to the next tab, and creates the project on the last one */
const onSubmit = (): void => {
    if (tab.value === 'manage_access') {
        void submitNewProject();
    } else {
        void nextTab();
    }
};

const submitNewProject = async (): Promise<void> => {
    if (creating.value || !(await validateDetails())) return;
    creating.value = true;
    errorMessage.value = '';
    try {
        await createProject(
            newProjectName.value,
            newProjectDescription.value,
            selected.value.map((metadataType) => metadataType.uuid),
            accessGroups.value.map((r) => ({
                accessGroupUUID: r.uuid,
                rights: r.rights,
            })),
            // @ts-ignore
            defaultRights.value?.data
                .filter(
                    (r) => !accessGroups.value.some((a) => a.uuid === r.uuid),
                )
                .map((r) => r.uuid),
        );
    } catch (error: unknown) {
        if (isNameError(error)) {
            // a rejected (e.g. taken) name is shown on the name field
            serverNameError.value = getErrorMessage(error);
            tab.value = 'details';
            focusField(nameId);
        } else {
            errorMessage.value = getDialogErrorMessage(error);
        }
        return;
    } finally {
        creating.value = false;
    }

    $q.notify({
        message: 'Project created successfully',
        color: 'positive',
        position: 'bottom',
        timeout: 2000,
    });
    onDialogOK();

    await queryClient.invalidateQueries({ queryKey: ['projects'] });
    await queryClient.invalidateQueries({ queryKey: ['permissions'] });
};
</script>
