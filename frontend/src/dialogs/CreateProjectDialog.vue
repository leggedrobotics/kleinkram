<template>
    <base-dialog ref="dialogRef">
        <template #title>Create Project</template>

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
                <q-tab name="tags" label="Configure Tags" style="color: #222" />
                <q-tab
                    name="manage_access"
                    label="Manage Access"
                    style="color: #222"
                />
            </q-tabs>
        </template>

        <template #content>
            <q-tab-panels v-model="tab">
                <q-tab-panel name="meta_data">
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
                    <div class="text-h6">Configure Tags</div>
                    <ConfigureTags v-model:selected="selected" />
                </q-tab-panel>

                <q-tab-panel name="manage_access">
                    <div class="text-h6">Manage Access</div>
                    <q-table
                        :columns="AccessRightsColumns"
                        :rows="accessRightsRows"
                        hide-pagination
                        flat
                        bordered
                        style="margin-top: 6px"
                    />
                    <ModifyAccessGroups
                        :existing-rights="{}"
                        @add-access-group-to-project="addAccessGroupToProject"
                        @add-users-to-project="addUserToProject"
                    />
                </q-tab-panel>
            </q-tab-panels>
        </template>
        <template #actions>
            <q-btn
                label="Create Project"
                color="primary"
                @click="submitNewProject"
                :disable="!formIsValid"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { QInput, useDialogPluginComponent } from 'quasar';
import { computed, Ref, ref } from 'vue';
import { createProject } from 'src/services/mutations/project';
import { AxiosError } from 'axios';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { getFilteredTagTypes } from 'src/services/queries/tag';
import { DataType } from 'src/enums/TAG_TYPES';
import { getAccessRightDescription } from 'src/services/generic';
import ModifyAccessGroups from 'components/ModifyAccessGroups.vue';
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { TagType } from 'src/types/TagType';
import ConfigureTags from 'components/ConfigureTags.vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

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
const tagSearch = ref('');
const selectedDataType = ref(DataType.ANY);
const selected: Ref<TagType[]> = ref([]);

const queryKey = computed(() => [
    'tags',
    tagSearch.value,
    selectedDataType.value,
]);
const { data: tags } = useQuery({
    queryKey: queryKey,
    queryFn: async () => {
        return getFilteredTagTypes(tagSearch.value, selectedDataType.value);
    },
});

const usersToAdd = ref<
    { userUUID: string; rights: AccessGroupRights; name: string }[]
>([]);
const accessGroupsToAdd = ref<
    { accessGroupUUID: string; rights: AccessGroupRights; name: string }[]
>([]);

function addUserToProject(newUser: {
    userUUID: string;
    rights: AccessGroupRights;
    name: string;
}) {
    const previousRights = usersToAdd.value.findIndex(
        (user) => user.userUUID === newUser.userUUID,
    );

    if (previousRights !== -1) {
        if (newUser.rights === AccessGroupRights.NONE) {
            usersToAdd.value.splice(previousRights, 1);
        }
        usersToAdd.value[previousRights].rights = newUser.rights;
        return;
    }
    if (newUser.rights === AccessGroupRights.NONE) {
        return;
    }
    usersToAdd.value.push(newUser);
}

function addAccessGroupToProject(newAccessGroup: {
    accessGroupUUID: string;
    rights: AccessGroupRights;
    name: string;
}) {
    const previousRights = accessGroupsToAdd.value.findIndex(
        (group) => group.accessGroupUUID === newAccessGroup.accessGroupUUID,
    );

    if (previousRights !== -1) {
        if (newAccessGroup.rights === AccessGroupRights.NONE) {
            accessGroupsToAdd.value.splice(previousRights, 1);
        }
        accessGroupsToAdd.value[previousRights].rights = newAccessGroup.rights;
        return;
    }
    if (newAccessGroup.rights === AccessGroupRights.NONE) {
        return;
    }
    accessGroupsToAdd.value.push(newAccessGroup);
}

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

const submitNewProject = async () => {
    await createProject(
        newProjectName.value,
        newProjectDescription.value,
        selected.value.map((tag) => tag.uuid),
        accessRightsRows.value,
    )
        .then(() => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
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
        });
};

const accessRightsRows = computed(() => {
    return [...usersToAdd.value, ...accessGroupsToAdd.value];
});

const AccessRightsColumns = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: (row: { name: string; rights: AccessGroupRights }) => row.name,
        sortable: true,
    },
    {
        name: 'rights',
        required: true,
        label: 'Rights',
        align: 'left',
        field: (row: { name: string; rights: AccessGroupRights }) =>
            `${getAccessRightDescription(row.rights)} (${row.rights})`,
        sortable: true,
    },
];
</script>
