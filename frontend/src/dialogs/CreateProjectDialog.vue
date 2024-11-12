<template>
    <BaseDialog ref="dialogRef">
        <template #title>New Project</template>

        <template #tabs>
            <q-tabs
                v-model="tab"
                dense
                class="text-grey"
                align="left"
                active-color="primary"
            >
                <q-tab
                    name="meta_data"
                    label="Project Details*"
                    style="color: #222"
                />
                <q-tab
                    name="tags"
                    label="Mission Metadata"
                    style="color: #222"
                    :disable="!formIsValid"
                />
                <q-tab
                    name="manage_access"
                    label="Manage Access"
                    style="color: #222"
                    :disable="!formIsValid"
                />
            </q-tabs>
        </template>

        <template #content>
            <q-tab-panels v-model="tab">
                <q-tab-panel name="meta_data" style="min-height: 280px">
                    <label for="projectName">Project Name *</label>
                    <q-input
                        name="projectName"
                        ref="projectNameInput"
                        v-model="newProjectName"
                        outlined
                        autofocus
                        dense
                        placeholder="Name...."
                        style="padding-bottom: 30px"
                        :error-message="errorMessagesProjectName"
                        :error="isInErrorStateProjectName"
                        :rules="[
                            (val) => !!val || 'Field is required',
                            (val) =>
                                val.length >= 3 ||
                                'Name must be at least 3 characters',
                            (val) =>
                                val.length <= 20 ||
                                'Name must be at most 20 characters',
                            (val) =>
                                /^[\w\-_]+$/g.test(val) ||
                                'Name must be alphanumeric and contain only - and _',
                        ]"
                        @update:model-value="verify_input"
                    />

                    <label for="projectDescription"
                        >Project Description *</label
                    >
                    <q-input
                        name="projectDescription"
                        v-model="newProjectDescription"
                        type="textarea"
                        outlined
                        dense
                        placeholder="Description...."
                        aria-placeholder="Project Name"
                        style="padding-bottom: 10px"
                        :error-message="errorMessagesProjectDescr"
                        :error="isInErrorStateProjectDescr"
                        @update:model-value="verify_input"
                        autofocus
                    />
                </q-tab-panel>

                <q-tab-panel name="tags">
                    <ConfigureMetadata v-model:selected="selected" />
                </q-tab-panel>

                <q-tab-panel name="manage_access">
                    <ConfigureAccess
                        v-model="accessGroups"
                        :min-access-rights="minAccessRights"
                    />
                </q-tab-panel>
            </q-tab-panels>
        </template>
        <template #actions v-if="tab === 'manage_access'">
            <q-btn
                flat
                label="Create Project"
                class="bg-button-primary"
                @click="submitNewProject"
                :disable="!formIsValid"
            />
        </template>
        <template #actions v-else>
            <q-btn
                flat
                label="Next"
                class="bg-button-primary"
                :disable="!formIsValid"
                @click="nextTab"
            />
        </template>
    </BaseDialog>
</template>

<script setup lang="ts">
import { QInput, useDialogPluginComponent, useQuasar } from 'quasar';
import { computed, Ref, ref, watch } from 'vue';
import { createProject } from 'src/services/mutations/project';
import { AxiosError } from 'axios';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { TagType } from 'src/types/TagType';
import ConfigureMetadata from 'components/ConfigureMetadata.vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import ConfigureAccess from 'components/ConfigureAccess.vue';
import {
    AccessRight,
    getDefaultAccessGroups,
} from 'src/services/queries/project';

const formIsValid = ref(false);
const isInErrorStateProjectName = ref(false);
const errorMessagesProjectName = ref<string>();
const isInErrorStateProjectDescr = ref(false);
const errorMessagesProjectDescr = ref<string>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const queryClient = useQueryClient();

const projectNameInput = ref<QInput>();
const newProjectName = ref('');
const newProjectDescription = ref('');
const invalidProjectNames = ref<string[]>([]);

const tab = ref('meta_data');

const selected: Ref<TagType[]> = ref([]);
const $q = useQuasar();

const { data: defaultRights } = useQuery({
    queryKey: ['defaultRights'],
    queryFn: getDefaultAccessGroups,
});

const minAccessRights = computed(() =>
    defaultRights.value
        ? defaultRights.value.filter((r) => r.name.startsWith('Personal: '))
        : [],
);

const accessGroups = ref<AccessRight[]>(defaultRights.value || []);
watch(defaultRights, () => {
    accessGroups.value = defaultRights.value || [];
});

const verify_input = () => {
    formIsValid.value =
        !!newProjectName.value &&
        !!newProjectDescription.value &&
        !invalidProjectNames.value.includes(newProjectName.value) &&
        !!newProjectName &&
        !!newProjectDescription;

    // client side verification
    if (
        !newProjectName.value ||
        invalidProjectNames.value.includes(newProjectName.value)
    ) {
        isInErrorStateProjectName.value = true;
        errorMessagesProjectName.value = 'Project name is required';
    } else {
        isInErrorStateProjectName.value = false;
        errorMessagesProjectName.value = '';
    }

    if (!newProjectDescription.value) {
        isInErrorStateProjectDescr.value = true;
        errorMessagesProjectDescr.value = 'Project description is required';
    } else {
        isInErrorStateProjectDescr.value = false;
        errorMessagesProjectDescr.value = '';
    }
};

const nextTab = () => {
    if (tab.value === 'meta_data') {
        tab.value = 'tags';
    } else if (tab.value === 'tags') {
        tab.value = 'manage_access';
    }
};

const submitNewProject = async () => {
    await createProject(
        newProjectName.value,
        newProjectDescription.value,
        selected.value.map((tag) => tag.uuid),
        accessGroups.value?.map((r) => ({
            accessGroupUUID: r.uuid,
            rights: r.rights,
        })) || [],
        defaultRights.value
            ?.filter((r) => !accessGroups.value?.find((a) => a.uuid === r.uuid))
            .map((r) => r.uuid),
    )
        .then(() => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['permissions'] });

            $q.notify({
                message: 'Project created successfully',
                color: 'positive',
                position: 'bottom',
                timeout: 2000,
            });

            onDialogOK();
        })
        .catch((error: AxiosError<{ message: string; statusCode: number }>) => {
            if (error.code == 'ERR_BAD_REQUEST') {
                isInErrorStateProjectName.value = true;
                errorMessagesProjectName.value = error.response?.data.message;
                invalidProjectNames.value.push(newProjectName.value);
            }

            isInErrorStateProjectName.value = true;
            errorMessagesProjectName.value = error.response?.data.message;

            // abort the close of the dialog
            dialogRef.value?.show();
            tab.value = 'meta_data';
        });
};
</script>
