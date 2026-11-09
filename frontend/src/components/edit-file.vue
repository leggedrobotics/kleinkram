<template>
    <base-dialog ref="dialogRef">
        <template #title> Edit File </template>
        <template #tabs>
            <q-tabs
                v-model="tab"
                dense
                class="text-grey"
                align="left"
                active-color="primary"
            >
                <q-tab
                    name="name"
                    label="Name & Location"
                    style="color: #222"
                />
                <q-tab
                    name="categories"
                    label="Configure Categories"
                    style="color: #222"
                />
            </q-tabs>
        </template>
        <template #content>
            <q-tab-panels v-model="tab">
                <q-tab-panel name="name" style="min-height: 280px">
                    <label for="filename" class="q-my-md">Filename</label>
                    <q-input
                        v-if="editableFile"
                        v-model="editableFile.filename"
                        name="filename"
                        outlined
                        dense
                        clearable
                        required
                    />
                    <div class="q-mt-md">
                        <ScopeSelector
                            v-model:project-uuid="projectUuid"
                            v-model:mission-uuid="missionUuid"
                            :required="true"
                            layout="column"
                        />
                    </div>
                </q-tab-panel>
                <q-tab-panel name="categories" style="min-height: 280px">
                    <ConfigureCategories
                        v-if="editableFile"
                        :file="editableFile"
                        @update:selected="onSelectionUpdate"
                    />
                </q-tab-panel>
            </q-tab-panels>
        </template>
        <template #actions>
            <q-btn
                label="Cancel"
                flat
                class="q-mr-sm button-border"
                @click="onDialogCancel"
            />
            <q-btn
                label="Save"
                class="bg-button-primary"
                :disable="
                    !dateTime ||
                    !editableFile ||
                    !missionUuid ||
                    !editableFile.filename
                "
                @click="_updateMission"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { CategoryDto } from '@kleinkram/api-dto/types/category.dto';
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, useDialogPluginComponent } from 'quasar';
import { formatDate, parseDate } from 'src/services/date-formating';
import { getErrorMessage } from 'src/services/error-handling';
import { updateFile } from 'src/services/mutations/file';
import { ref, watch } from 'vue';

// Components & Hooks
import ScopeSelector from 'components/common/scope-selector.vue';
import ConfigureCategories from 'components/configure-categories.vue';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useFile } from 'src/hooks/query-hooks';

const { fileUuid } = defineProps<{ fileUuid: string }>();

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const queryClient = useQueryClient();
const tab = ref('name');

// --- Data Fetching ---
const { data: queryData } = useFile(fileUuid);

// --- Local State ---
const dateTime = ref('');
const editableFile = ref<FileWithTopicDto | undefined>(undefined);

// --- Scope Selection Logic ---
const projectUuid = ref<string | undefined>(undefined);
const missionUuid = ref<string | undefined>(undefined);

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

const { mutate: updateFileMutation } = useMutation({
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
    onError(error: unknown) {
        console.error(error);

        Notify.create({
            group: false,
            message: `Error updating file: ${getErrorMessage(error)}`,
            color: 'negative',
            spinner: false,
            position: 'bottom',
            timeout: 3000,
        });
    },
});

function _updateMission(): void {
    const convertedDate = parseDate(dateTime.value);

    if (
        editableFile.value &&
        missionUuid.value &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        convertedDate &&
        !Number.isNaN(convertedDate.getTime())
    ) {
        editableFile.value.date = convertedDate;

        // The mission selected in the ScopeSelector is the target location of
        // the file; sending a different mission than the current one moves it.
        updateFileMutation({
            file: editableFile.value,
            missionUuid: missionUuid.value,
        });
        onDialogOK();
    }
}

const onSelectionUpdate = ($event: CategoryDto[]): void => {
    if (editableFile.value) {
        editableFile.value.categories = $event;
    }
};
</script>
