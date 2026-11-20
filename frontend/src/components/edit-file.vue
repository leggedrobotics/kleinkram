<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="isPending"
        fixed-height
        :dirty="dirty"
        :submit-disabled="isPending || creatingCategory"
        @submit="saveFile"
    >
        <template #title>Edit File</template>
        <template #tabs>
            <q-tabs
                v-model="tab"
                dense
                align="left"
                active-color="button-primary"
                indicator-color="button-primary"
            >
                <q-tab name="name" label="Name & Location" />
                <q-tab name="categories" label="Categories" />
            </q-tabs>
        </template>
        <template #content>
            <div class="dialog-tab-panels">
                <div
                    role="tabpanel"
                    class="dialog-tab-panel"
                    :class="{ 'dialog-tab-panel--active': tab === 'name' }"
                    :inert="tab !== 'name'"
                >
                    <q-form ref="formReference" greedy @submit.prevent>
                        <label :for="filenameId">
                            Name<span class="text-error">*</span>
                        </label>
                        <NameField
                            v-if="editableFile"
                            :id="filenameId"
                            v-model="baseName"
                            kind="file"
                            label="File name"
                            autofocus
                            :suffix="fileEnding"
                            :accepted="acceptedBaseName"
                            :server-error="serverNameError"
                            @edit="clearServerNameError"
                        />
                        <div class="field-group">
                            <ScopeSelector
                                v-model:project-uuid="projectUuid"
                                v-model:mission-uuid="missionUuid"
                                :required="true"
                                layout="column"
                            />
                        </div>
                    </q-form>
                </div>
                <div
                    role="tabpanel"
                    class="dialog-tab-panel"
                    :class="{
                        'dialog-tab-panel--active': tab === 'categories',
                    }"
                    :inert="tab !== 'categories'"
                >
                    <ConfigureCategories
                        v-if="editableFile"
                        :file="editableFile"
                        @update:selected="onSelectionUpdate"
                        @update:creating="onCreatingUpdate"
                    />
                </div>
            </div>
        </template>
        <template #actions>
            <q-btn
                flat
                no-caps
                label="Save File"
                class="bg-button-primary"
                :loading="isPending || creatingCategory"
                @click="saveFile"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { CategoryDto } from '@kleinkram/api-dto/types/category.dto';
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, QForm, useDialogPluginComponent } from 'quasar';
import { formatDate, parseDate } from 'src/services/date-formating';
import {
    focusField,
    getDialogErrorMessage,
    getErrorMessage,
    isNameError,
} from 'src/services/error-handling';
import { updateFile } from 'src/services/mutations/file';
import { computed, nextTick, ref, useId, watch } from 'vue';

// Components & Hooks
import NameField from 'components/common/name-field.vue';
import ScopeSelector from 'components/common/scope-selector.vue';
import ConfigureCategories from 'components/configure-categories.vue';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useFile } from 'src/hooks/query-hooks';

const { fileUuid } = defineProps<{ fileUuid: string }>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const queryClient = useQueryClient();
const tab = ref('name');
const filenameId = `edit-file-name-${useId()}`;

/**
 * The ending of the stored file name, e.g. ".bag": fixed, only the base name
 * can be renamed (uploads only accept lowercase endings, so it never needs
 * fixing here)
 */
const endingOf = (filename: string): string => {
    const dot = filename.lastIndexOf('.');
    return dot > 0 ? filename.slice(dot) : '';
};
const fileEnding = computed(() => endingOf(queryData.value?.filename ?? ''));
const withoutEnding = (filename: string): string =>
    fileEnding.value !== '' && filename.endsWith(fileEnding.value)
        ? filename.slice(0, -fileEnding.value.length)
        : filename;
const baseName = computed({
    get: () => withoutEnding(editableFile.value?.filename ?? ''),
    set: (value: string) => {
        if (editableFile.value)
            editableFile.value.filename = value + fileEnding.value;
    },
});
// a name from before the naming rules is kept until it changes
const acceptedBaseName = computed(() =>
    queryData.value ? withoutEnding(queryData.value.filename) : undefined,
);
const errorMessage = ref('');
// the server rejected the name, e.g. it is already taken in the mission
const serverNameError = ref('');
const clearServerNameError = (): void => {
    serverNameError.value = '';
};
const formReference = ref<QForm>();

// --- Data Fetching ---
const { data: queryData } = useFile(fileUuid);

// --- Local State ---
const dateTime = ref('');
const editableFile = ref<FileWithTopicDto | undefined>(undefined);

// --- Scope Selection Logic ---
const projectUuid = ref<string | undefined>(undefined);
const missionUuid = ref<string | undefined>(undefined);

/** The state the form started from, to tell whether it was changed */
const initialState = ref('');
const snapshot = (): string =>
    JSON.stringify({
        filename: editableFile.value?.filename,
        missionUuid: missionUuid.value,
        categories: (editableFile.value?.categories ?? [])
            .map((category) => category.uuid)
            .toSorted(),
    });
const dirty = computed(
    () => initialState.value !== '' && snapshot() !== initialState.value,
);

const { selectedMission, selectedProject } = useScopeSelection(
    projectUuid,
    missionUuid,
);

// --- Synchronization ---

watch(
    queryData,
    (newValue) => {
        if (!newValue) return;

        // Initialize ScopeSelector
        projectUuid.value = newValue.mission.project.uuid;
        missionUuid.value = newValue.mission.uuid;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, unicorn/prefer-structured-clone
        editableFile.value = JSON.parse(JSON.stringify(newValue));
        dateTime.value = formatDate(new Date(newValue.date));
        initialState.value = snapshot();
    },
    { immediate: true },
);

watch(selectedMission, (newMission) => {
    if (editableFile.value && newMission) {
        editableFile.value.mission = {
            // eslint-disable-next-line @typescript-eslint/no-misused-spread
            ...newMission,
            project:
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                selectedProject.value ?? editableFile.value.mission?.project,
        };
    }
});

const { mutateAsync: updateFileMutation, isPending } = useMutation({
    mutationFn: (payload: { file: FileWithTopicDto; missionUuid: string }) =>
        updateFile(payload),
    onSuccess: async () => {
        Notify.create({
            group: false,
            message: 'File updated',
            color: 'positive',
            spinner: false,
            position: 'bottom',
            timeout: 3000,
        });
        onDialogOK();
        const cache = queryClient.getQueryCache();
        const filtered = cache.getAll().filter(
            (query) =>
                query.queryKey[0] === 'Filtered Files' ||
                (query.queryKey[0] === 'file' &&
                    query.queryKey[1] === fileUuid) ||
                query.queryKey[0] === 'files' ||
                // a file may have been moved into another mission
                query.queryKey[0] === 'missions',
        );

        await Promise.all(
            filtered.map((query) =>
                queryClient.invalidateQueries({ queryKey: query.queryKey }),
            ),
        );
    },
});

async function saveFile(): Promise<void> {
    if (isPending.value || creatingCategory.value) return;
    // shows what is missing or wrong, on the first tab
    if (!(await formReference.value?.validate())) {
        tab.value = 'name';
        await nextTick();
        await formReference.value?.validate(true);
        return;
    }
    const convertedDate = parseDate(dateTime.value);

    if (
        !dateTime.value ||
        !editableFile.value ||
        !missionUuid.value ||
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        !convertedDate ||
        Number.isNaN(convertedDate.getTime())
    ) {
        return;
    }
    editableFile.value.date = convertedDate;
    errorMessage.value = '';

    // The mission selected in the ScopeSelector is the target location of
    // the file; sending a different mission than the current one moves it.
    try {
        await updateFileMutation({
            file: editableFile.value,
            missionUuid: missionUuid.value,
        });
    } catch (error: unknown) {
        if (isNameError(error)) {
            // e.g. the name is taken in the mission: shown on the name field
            serverNameError.value = getErrorMessage(error);
            tab.value = 'name';
            focusField(filenameId);
        } else {
            errorMessage.value = getDialogErrorMessage(error);
        }
    }
}

// a category typed in the selector is still being created: saving now
// would leave it out
const creatingCategory = ref(false);
const onCreatingUpdate = (creating: boolean): void => {
    creatingCategory.value = creating;
};

const onSelectionUpdate = ($event: CategoryDto[]): void => {
    if (editableFile.value) {
        editableFile.value.categories = $event;
    }
};
</script>
