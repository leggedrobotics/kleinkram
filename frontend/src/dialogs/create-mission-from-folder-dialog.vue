<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="creating"
        fixed-height
        size="lg"
        :dirty="dirty"
        :submit-disabled="creating"
        @submit="onSubmit"
    >
        <template #title>Upload Folder</template>

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
                    :disable="!isValidName(missionName) || missionCreated"
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
                        <p>
                            Project: <b>{{ project?.name }}</b>
                        </p>

                        <label :for="folderId">
                            Folder<span class="text-error">*</span>
                        </label>
                        <input
                            ref="HTMLinput"
                            type="file"
                            webkitdirectory
                            style="display: none"
                            @change="handle"
                        />
                        <q-file
                            v-model="files"
                            no-error-icon
                            :for="folderId"
                            outlined
                            dense
                            multiple
                            color="button-primary"
                            lazy-rules
                            :rules="[folderRule]"
                            @click="transferClick"
                        >
                            <template #prepend>
                                <q-icon name="sym_o_attach_file" />
                            </template>

                            <template v-if="files.length > 0" #append>
                                <q-btn
                                    flat
                                    round
                                    dense
                                    size="sm"
                                    icon="sym_o_cancel"
                                    aria-label="Clear selected folder"
                                    @click.stop.prevent="onCancel"
                                />
                            </template>
                        </q-file>

                        <label :for="nameId">
                            Name<span class="text-error">*</span>
                        </label>
                        <NameField
                            :id="nameId"
                            v-model="missionName"
                            label="Mission name"
                            :server-error="serverErrorMessage"
                            @edit="onModelValueUpdate"
                        />
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
                            v-model:server-errors="metadataServerErrors"
                            :metadata-values="metadataValues"
                            :project-uuid="project.uuid"
                            @update:metadata-values="onMetadataValuesUpdate"
                        />
                    </q-form>
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
                @click="goToMetadataTab"
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
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import type { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
import { isValidName, suggestName } from '@kleinkram/validation/frontend';
import { useQueryClient } from '@tanstack/vue-query';
import NameField from 'components/common/name-field.vue';
import SelectMissionMetadata from 'components/select-mission-metadata.vue';
import { Notify, QForm, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useProjectQuery } from 'src/hooks/query-hooks';
import {
    focusField,
    getDialogErrorMessage,
    getErrorMessage,
    getFieldErrors,
    isNameError,
} from 'src/services/error-handling';
import { createFileAction } from 'src/services/file-service';
import { createMission } from 'src/services/mutations/mission';
import { computed, nextTick, ref, Ref, useId, watch } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

// eslint-disable-next-line @typescript-eslint/naming-convention
const tab_selection = ref('details');

const properties = defineProps<{
    projectUuid: string | undefined;
    uploads: Ref<FileUploadDto[]>;
}>();

const HTMLinput = ref();
const projectUuid = ref(properties.projectUuid);
const newMission: Ref<FlatMissionDto | undefined> = ref(undefined);
const queryClient = useQueryClient();
const files = ref<File[]>([]);

const { data: project, refetch } = useProjectQuery(projectUuid);

// we load the new project if the projectUuid changes
watch(projectUuid, () => refetch());

const nameId = `upload-folder-name-${useId()}`;
const folderId = `upload-folder-folder-${useId()}`;
const formReference = ref<QForm>();
const metadataFormReference = ref<QForm>();
// errors the server reported per metadata type uuid
const metadataServerErrors = ref<Record<string, string>>({});
const missionName = ref('');
// error returned by the server, e.g. if the name is already taken
const serverErrorMessage = ref('');
const errorMessage = ref('');
const creating = ref(false);
const uploadingFiles = ref<Record<string, Record<string, string>>>({});

const metadataValues: Ref<Record<string, string>> = ref({});

const missionCreated = computed(() => {
    return !!newMission.value;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handle = (a: any): void => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    files.value = a.target.files;
    if (files.value.length > 0) {
        const folderName =
            files.value[0]?.webkitRelativePath.split('/')[0] ?? '';
        // folder names often contain spaces, propose a valid name instead
        missionName.value = isValidName(folderName)
            ? folderName
            : (suggestName(folderName) ?? folderName);
    }
};

const isUploadable = (file: File): boolean =>
    file.name.endsWith('.bag') || file.name.endsWith('.mcap');

/** A folder must be chosen and hold at least one file we can upload */
const folderRule = (chosen: File[] | null): true | string => {
    const all = [...(chosen ?? [])];
    if (all.length === 0) return 'Choose a folder.';
    return all.some((file) => isUploadable(file))
        ? true
        : 'No .bag or .mcap files in this folder.';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transferClick(event: any): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    event.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    HTMLinput.value.click();
}

const dirty = computed(
    () =>
        !missionCreated.value &&
        (files.value.length > 0 ||
            missionName.value !== '' ||
            Object.values(metadataValues.value).some((value) => value !== '')),
);

/** Enter runs the main action of the current step */
const onSubmit = (): void => {
    if (tab_selection.value === 'details') void goToMetadataTab();
    else void submitNewMission();
};

const submitNewMission = async (): Promise<void> => {
    if (project.value === undefined || creating.value) {
        return;
    }
    if (!isValidName(missionName.value) || folderRule(files.value) !== true) {
        // the details tab shows what is missing or invalid
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
    const created = createFileAction(
        newMission.value,
        newMission.value.project,
        [...files.value].filter((file) => isUploadable(file)),
        queryClient,
        uploadingFiles,
        // @ts-ignore
        properties.uploads,
    );
    onDialogOK();
    const projectUuidOfMission = project.value.uuid;
    await queryClient.invalidateQueries({
        predicate: (query) =>
            query.queryKey[0] === 'missions' &&
            query.queryKey[1] === projectUuidOfMission,
    });
    await created;
};

const goToMetadataTab = async (): Promise<void> => {
    if (!(await formReference.value?.validate(true))) return;
    tab_selection.value = 'metadata';
};

const onModelValueUpdate = (): void => {
    serverErrorMessage.value = '';
};

const onCancel = (): void => {
    files.value = [];
};

const onMetadataValuesUpdate = (update: Record<string, string>): void => {
    metadataValues.value = update;
};
</script>
