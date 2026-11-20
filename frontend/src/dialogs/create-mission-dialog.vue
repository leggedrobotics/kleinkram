<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="creating"
        fixed-height
        size="lg"
        :dirty="dirty"
        :cancel-label="tab_selection === 'upload' ? 'Skip Upload' : 'Cancel'"
        :submit-disabled="submitDisabled"
        @submit="onSubmit"
    >
        <template #title>New Mission</template>

        <template #tabs>
            <q-tabs
                v-model="tab_selection"
                dense
                align="left"
                active-color="button-primary"
                indicator-color="button-primary"
            >
                <q-tab
                    name="details"
                    label="Details"
                    :disable="missionCreated"
                />
                <q-tab
                    name="metadata"
                    label="Metadata"
                    :disable="
                        !project || !isValidName(missionName) || missionCreated
                    "
                />
                <q-tab
                    name="upload"
                    label="Upload"
                    :disable="!missionCreated"
                />
            </q-tabs>
        </template>
        <template #content>
            <div class="dialog-tab-panels">
                <div
                    role="tabpanel"
                    class="dialog-tab-panel"
                    :class="{
                        'dialog-tab-panel--active': tab_selection === 'details',
                    }"
                    :inert="tab_selection !== 'details'"
                >
                    <q-form ref="formReference" greedy @submit.prevent>
                        <div
                            v-if="
                                !projectsWithCreateWrite ||
                                projectsWithCreateWrite.length === 0
                            "
                            class="text-secondary"
                        >
                            <q-icon
                                name="sym_o_info"
                                size="sm"
                                class="q-mr-sm"
                            />
                            You do not have permission to create missions, or no
                            projects exist yet.
                        </div>
                        <div v-else>
                            <ScopeSelector
                                v-model:project-uuid="projectUuid"
                                :custom-projects="projectsWithCreateWrite"
                                :show-mission="false"
                                :required="true"
                                class="field-group"
                            />

                            <template v-if="projectUuid">
                                <label :for="nameId">
                                    Name<span class="text-error">*</span>
                                </label>
                                <NameField
                                    :id="nameId"
                                    v-model="missionName"
                                    label="Mission name"
                                    autofocus
                                    :server-error="serverErrorMessage"
                                    @edit="onMissionNameChange"
                                />
                            </template>
                            <div v-else class="text-secondary">
                                Please select a project to create a mission.
                            </div>
                        </div>
                    </q-form>
                </div>
                <div
                    role="tabpanel"
                    class="dialog-tab-panel"
                    :class="{
                        'dialog-tab-panel--active':
                            tab_selection === 'metadata',
                    }"
                    :inert="tab_selection !== 'metadata'"
                >
                    <q-form ref="metadataFormReference" greedy @submit.prevent>
                        <SelectMissionMetadata
                            v-if="project"
                            :key="project.uuid"
                            v-model:server-errors="metadataServerErrors"
                            :metadata-values="metadataValues"
                            :project-uuid="project.uuid"
                            @update:metadata-values="updateMetadataValues"
                        />
                    </q-form>
                </div>
                <div
                    role="tabpanel"
                    class="dialog-tab-panel"
                    :class="{
                        'dialog-tab-panel--active': tab_selection === 'upload',
                    }"
                    :inert="tab_selection !== 'upload'"
                >
                    <template v-if="newMission">
                        <p class="mission-created">
                            <q-icon name="sym_o_check" size="20px" />
                            Mission <b>{{ newMission.name }}</b> created
                        </p>
                        <CreateFile
                            ref="createFileReference"
                            v-model:has-errors="uploadHasErrors"
                            :mission="newMission"
                            :uploads="uploads"
                            :disable-scope="true"
                        />
                    </template>
                </div>
            </div>
        </template>

        <template #actions>
            <q-btn
                v-if="tab_selection === 'details'"
                flat
                no-caps
                label="Next"
                class="bg-button-primary"
                @click="navigateToMetadataTab"
            />
            <q-btn
                v-if="tab_selection === 'metadata'"
                flat
                no-caps
                label="Create Mission"
                class="bg-button-primary"
                :loading="creating"
                @click="submitNewMission"
            />
            <span v-if="tab_selection === 'upload'" class="disabled-reason">
                <q-btn
                    flat
                    no-caps
                    label="Upload & Close"
                    class="bg-button-primary"
                    :disable="uploadHasErrors"
                    @click="uploadEventHandler"
                />
                <q-tooltip v-if="uploadHasErrors"
                    >Fix the file names first</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import type { ProjectsDto } from '@kleinkram/api-dto/types/project/projects.dto';
import type { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
import { isValidName } from '@kleinkram/validation/frontend';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import NameField from 'components/common/name-field.vue';
import ScopeSelector from 'components/common/scope-selector.vue';
import CreateFile from 'components/create-file.vue';
import SelectMissionMetadata from 'components/select-mission-metadata.vue';
import { Notify, QForm, useDialogPluginComponent } from 'quasar';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { canCreateMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import {
    focusField,
    getDialogErrorMessage,
    getErrorMessage,
    getFieldErrors,
    isNameError,
} from 'src/services/error-handling';
import { createMission } from 'src/services/mutations/mission';
import { filteredProjects } from 'src/services/queries/project';
import { computed, nextTick, ref, Ref, useId } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

// eslint-disable-next-line @typescript-eslint/naming-convention
const tab_selection = ref('details');
const createFileReference = ref<InstanceType<typeof CreateFile> | undefined>(
    undefined,
);
const uploadHasErrors = ref(false);

const props = defineProps<{
    projectUuid: string | undefined;
    uploads: Ref<FileUploadDto[]>;
}>();

const projectUuid = ref(props.projectUuid);

const newMission: Ref<FlatMissionDto | undefined> = ref(undefined);
const queryClient = useQueryClient();

const { selectedProject: project } = useScopeSelection(projectUuid);

const nameId = `new-mission-name-${useId()}`;
const missionName = ref('');
const creating = ref(false);
// a failure that is not about the name itself
const errorMessage = ref('');
// error returned by the server, e.g. if the name is already taken
const serverErrorMessage = ref('');
const formReference = ref<QForm>();
const metadataFormReference = ref<QForm>();
// errors the server reported per metadata type uuid
const metadataServerErrors = ref<Record<string, string>>({});

// eslint-disable-next-line @typescript-eslint/naming-convention
const { data: all_projects } = useQuery<ProjectsDto>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name'),
});
const { data: permissions } = usePermissionsQuery();
const projectsWithCreateWrite = computed(() => {
    if (!all_projects.value) return [];
    return all_projects.value.data.filter((_project) =>
        canCreateMission(_project.uuid, permissions.value),
    );
});

const metadataValues: Ref<Record<string, string>> = ref({});

const missionCreated = computed(() => {
    return !!newMission.value;
});

// before the mission exists, closing would lose the name and metadata
const dirty = computed(
    () =>
        !missionCreated.value &&
        (missionName.value !== '' ||
            Object.values(metadataValues.value).some((value) => value !== '')),
);

const submitDisabled = computed(() => {
    if (tab_selection.value === 'metadata') return creating.value;
    return uploadHasErrors.value;
});

/** Enter runs the main action of the current step */
const onSubmit = (): void => {
    if (tab_selection.value === 'details') void navigateToMetadataTab();
    else if (tab_selection.value === 'metadata') void submitNewMission();
    else uploadEventHandler();
};

const submitNewMission = async (): Promise<void> => {
    if (!project.value || creating.value) {
        return;
    }
    if (!isValidName(missionName.value) || serverErrorMessage.value) {
        // the details tab shows why the name is invalid
        tab_selection.value = 'details';
        await nextTick();
        await formReference.value?.validate(true);
        return;
    }
    if (!(await metadataFormReference.value?.validate())) {
        tab_selection.value = 'metadata';
        await nextTick();
        await metadataFormReference.value?.validate(true);
        return;
    }
    creating.value = true;
    errorMessage.value = '';
    let resp: FlatMissionDto;
    try {
        resp = (await createMission(
            missionName.value,
            project.value.uuid,
            metadataValues.value,
        )) as FlatMissionDto;
    } catch (error: unknown) {
        const fieldErrors = getFieldErrors(error);
        if (fieldErrors) {
            // shown on the metadata fields they belong to
            metadataServerErrors.value = fieldErrors;
            tab_selection.value = 'metadata';
        } else if (isNameError(error)) {
            // a rejected (e.g. taken) name is shown on the name field
            tab_selection.value = 'details';
            serverErrorMessage.value = getErrorMessage(error);
            focusField(nameId);
        } else {
            errorMessage.value = getDialogErrorMessage(error);
        }
        return;
    } finally {
        creating.value = false;
    }

    newMission.value = resp;
    // @ts-ignore
    newMission.value.project = project.value;
    Notify.create({
        message: `Mission ${missionName.value} created`,
        color: 'positive',
        spinner: false,
        timeout: 4000,
        position: 'bottom',
    });
    missionName.value = '';
    metadataValues.value = {};
    tab_selection.value = 'upload';

    await queryClient.invalidateQueries({
        predicate: (query) =>
            query.queryKey[0] === 'missions' &&
            query.queryKey[1] === project.value?.uuid,
    });
};

const updateMetadataValues = (update: Record<string, string>): void => {
    metadataValues.value = update;
};

const uploadEventHandler = (): void => {
    if (createFileReference.value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (createFileReference.value as any).createFileAction();
    }
    onDialogOK();
};

function onMissionNameChange(): void {
    serverErrorMessage.value = '';
}

async function navigateToMetadataTab(): Promise<void> {
    if (!(await formReference.value?.validate(true))) return;
    tab_selection.value = 'metadata';
}
</script>

<style scoped>
/* $support-success check, $text-primary text */
.mission-created {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #161616;
    overflow-wrap: anywhere;
}

.mission-created .q-icon {
    flex: none;
    color: #198038;
}
</style>
