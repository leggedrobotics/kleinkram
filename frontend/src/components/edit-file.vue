<template>
    <base-dialog ref="dialogRef">
        <template #title> Edit File</template>
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
                        <label for="project">Project</label>
                        <q-btn-dropdown
                            v-model="dd_open"
                            :label="selected_project?.name || 'Project'"
                            class="button-border full-width"
                            name="project"
                            flat
                            dense
                            clearable
                            required
                        >
                            <q-list>
                                <q-item
                                    v-for="project in projects"
                                    :key="project.uuid"
                                    clickable
                                    @click="
                                        // eslint-disable-next-line vue/v-on-handler-style
                                        () => onClick(project)
                                    "
                                >
                                    <q-item-section>
                                        <q-item-label>
                                            {{ project.name }}
                                        </q-item-label>
                                    </q-item-section>
                                </q-item>
                            </q-list>
                        </q-btn-dropdown>
                    </div>
                    <div class="q-mt-md">
                        <label for="mission">Mission</label>
                        <q-btn-dropdown
                            v-model="dd_open_2"
                            :label="editableFile?.mission.name || 'Mission'"
                            class="button-border full-width"
                            name="mission"
                            flat
                            dense
                            clearable
                            required
                        >
                            <q-list>
                                <q-item
                                    v-for="mission in missions"
                                    :key="mission.uuid"
                                    clickable
                                    @click="
                                        () => {
                                            if (editableFile === null) return;
                                            editableFile.mission = mission;
                                            dd_open_2 = false;
                                        }
                                    "
                                >
                                    <q-item-section>
                                        <q-item-label>
                                            {{ mission.name }}
                                        </q-item-label>
                                    </q-item-section>
                                </q-item>
                            </q-list>
                        </q-btn-dropdown>
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
                    !editableFile.mission ||
                    !editableFile.filename
                "
                @click="_updateMission"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';

import { computed, Reactive, reactive, ref, watch } from 'vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { formatDate, parseDate } from '../services/date-formating';
import { filteredProjects } from 'src/services/queries/project';
import { updateFile } from 'src/services/mutations/file';
import BaseDialog from '../dialogs/base-dialog.vue';
import { useFile, useMissionsOfProjectMinimal } from '../hooks/query-hooks';

import { FileWithTopicDto } from '@api/types/file/file.dto';
import { ProjectDto } from '@api/types/project/base-project.dto';
import { ProjectsDto } from '@api/types/project/projects.dto';
import ConfigureCategories from '@components/configure-categories.vue';
import { isAxiosError } from 'axios';
import { CategoryDto } from '@api/types/category.dto';
import { ProjectWithCreator } from '@api/types/project/project-with-creator.dto';

const { fileUuid } = defineProps<{ fileUuid: string }>();

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const queryClient = useQueryClient();
const tab = ref('name');

const dd_open = ref(false);
const dd_open_2 = ref(false);
const selected_project = ref<ProjectDto | undefined>(undefined);
const { data: queryData } = useFile(fileUuid);

const dateTime = ref('');
// @ts-ignore
const editableFile: Reactive<FileWithTopicDto> = reactive({});
// Watch for changes in data.value and update dateTime accordingly
watch(
    () => queryData.value,
    (newValue) => {
        if (!newValue) return;

        selected_project.value = newValue.mission.project;

        if (newValue !== null && newValue !== undefined) {
            Object.assign(editableFile, newValue); // Update the reactive object
            dateTime.value = formatDate(new Date(newValue.date));
        }
    },
    { immediate: true }, // Trigger immediately on component mount
);

const projectsReturn = useQuery<ProjectsDto>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name'),
});
const projects = computed(() =>
    projectsReturn.data.value
        ? projectsReturn.data.value.data
        : ([] as ProjectWithCreator[]),
);

const { data: _missions, refetch } = useMissionsOfProjectMinimal(
    selected_project.value?.uuid ?? '',
    100,
    0,
);
const missions = computed(() => (_missions.value ? _missions.value.data : []));

watch(
    () => selected_project.value,
    async (newValue) => {
        if (newValue) {
            await refetch().then(() => {
                if (
                    editableFile &&
                    missions.value.length !== undefined &&
                    missions.value.length > 0 &&
                    editableFile.mission.project.uuid !==
                        selected_project.value?.uuid
                ) {
                    editableFile.mission = missions.value[0];
                }
            });
        }
    },
    {
        immediate: false,
    },
);

const { mutate: updateFileMutation } = useMutation({
    mutationFn: (fileData: FileWithTopicDto) => updateFile({ file: fileData }),
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
        const filtered = cache
            .getAll()
            .filter(
                (query) =>
                    query.queryKey[0] === 'Filtered Files' ||
                    (query.queryKey[0] === 'file' &&
                        query.queryKey[1] === fileUuid) ||
                    query.queryKey[0] === 'files',
            );

        await Promise.all(
            filtered.map((query) =>
                queryClient.invalidateQueries({ queryKey: query.queryKey }),
            ),
        );
    },
    onError(error: unknown) {
        console.log(error);

        // Use a type guard to check if the error is an AxiosError
        if (isAxiosError(error)) {
            const errorMessage: string =
                error.response?.data?.message ?? 'Unknown error message';
            Notify.create({
                group: false,
                message: `Error updating file: ${errorMessage}`,
                color: 'negative',
                spinner: false,
                position: 'bottom',
                timeout: 3000,
            });
        } else if (error instanceof Error) {
            // If it's a generic Error, use the message property
            Notify.create({
                group: false,
                message: `Error updating file: ${error.message}`,
                color: 'negative',
                spinner: false,
                position: 'bottom',
                timeout: 3000,
            });
        } else {
            // Handle unexpected error structure
            Notify.create({
                group: false,
                message: 'Error updating file: Unknown error occurred',
                color: 'negative',
                spinner: false,
                position: 'bottom',
                timeout: 3000,
            });
        }
    },
});

function _updateMission() {
    const convertedDate = parseDate(dateTime.value);
    if (
        editableFile &&
        convertedDate &&
        !Number.isNaN(convertedDate.getTime())
    ) {
        editableFile.date = convertedDate;
        const noncircularMission = editableFile.mission;
        // @ts-ignore
        noncircularMission.project = undefined;
        editableFile.mission = noncircularMission;
        updateFileMutation(editableFile);
        onDialogOK();
    }
}

const onClick = (project: ProjectDto) => {
    selected_project.value = project;
    dd_open.value = false;
    dd_open_2.value = true;
};

const onSelectionUpdate = ($event: CategoryDto[]) => {
    if (editableFile !== null) editableFile.categories = $event;
};
</script>

<style scoped></style>
