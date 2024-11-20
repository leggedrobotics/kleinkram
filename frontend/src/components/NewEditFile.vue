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
                                        selected_project = project;
                                        dd_open = false;
                                        dd_open_2 = true;
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
                                        editableFile.mission = mission;
                                        dd_open_2 = false;
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
                        v-if="data?.mission?.project"
                        :file="editableFile"
                        @update:selected="editableFile.categories = $event"
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

import { computed, Ref, ref, watch } from 'vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { formatDate, parseDate } from 'src/services/dateFormating';
import { Project } from 'src/types/Project';
import { FileEntity } from 'src/types/FileEntity';
import { fetchFile } from 'src/services/queries/file';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProjectMinimal } from 'src/services/queries/mission';
import { updateFile } from 'src/services/mutations/file';
import { Mission } from 'src/types/Mission';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import ConfigureCategories from 'components/ConfigureCategories.vue';
import { FileState } from '@common/enum';

const props = defineProps<{
    file_uuid: string;
}>();

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const queryClient = useQueryClient();
const tab = ref('name');

const dd_open = ref(false);
const dd_open_2 = ref(false);
const selected_project = ref<Project | null | undefined>(null);
const { data } = useQuery({
    queryKey: ['file', props.file_uuid],
    queryFn: () => fetchFile(props.file_uuid),
});

const dateTime = ref('');
const editableFile: Ref<FileEntity | null> = ref(null);
// Watch for changes in data.value and update dateTime accordingly
watch(
    () => data.value,
    (newValue) => {
        if (!newValue) return;
        selected_project.value = newValue?.mission?.project;
        if (newValue?.date && data.value) {
            editableFile.value = new FileEntity(
                newValue.uuid,
                newValue.filename,
                newValue.mission?.clone() as Mission,
                newValue.creator,
                newValue.date,
                [],
                newValue.size,
                newValue.type,
                FileState.UPLOADING,
                newValue.hash,
                newValue.categories,
                newValue.createdAt,
                newValue.updatedAt,
            );
            dateTime.value = formatDate(new Date(newValue.date));
        }
    },
    {
        immediate: true, // Mission the watcher immediately on component mount
    },
);
const projectsReturn = useQuery<[Project[], number]>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name'),
});
const projects = computed(() =>
    projectsReturn.data.value ? projectsReturn.data.value[0] : [],
);

const { data: _missions, refetch } = useQuery<[Mission[], number]>({
    queryKey: ['missions', selected_project.value?.uuid],
    queryFn: () => missionsOfProjectMinimal(selected_project.value?.uuid || ''),
    enabled: !!selected_project.value?.uuid,
});
const missions = computed(() => (_missions.value ? _missions.value[0] : []));

watch(
    () => selected_project.value,
    async (newValue) => {
        if (newValue) {
            await refetch().then(() => {
                if (
                    editableFile.value &&
                    missions.value?.length !== undefined &&
                    missions.value?.length > 0 &&
                    editableFile.value?.mission?.project?.uuid !==
                        selected_project.value?.uuid
                ) {
                    editableFile.value.mission = missions.value[0];
                }
            });
        }
    },
    {
        immediate: false,
    },
);

const { mutate: updateFileMutation } = useMutation({
    mutationFn: (fileData: FileEntity) => updateFile({ file: fileData }),
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
                        query.queryKey[1] === props.file_uuid) ||
                    query.queryKey[0] === 'files',
            );

        await Promise.all(
            filtered.map((query) =>
                queryClient.invalidateQueries({ queryKey: query.queryKey }),
            ),
        );
    },
    onError(e) {
        console.log(e);
        Notify.create({
            group: false,
            message: 'Error updating file: ' + e.response.data.message,
            color: 'negative',
            spinner: false,
            position: 'bottom',
            timeout: 3000,
        });
    },
});

function _updateMission() {
    const convertedDate = parseDate(dateTime.value);
    if (
        editableFile.value &&
        convertedDate &&
        !isNaN(convertedDate.getTime())
    ) {
        editableFile.value.date = convertedDate;
        const noncircularMission =
            editableFile.value?.mission?.clone() as Mission;
        noncircularMission.project = undefined;
        noncircularMission.files = [];
        editableFile.value.mission = noncircularMission;
        updateFileMutation(editableFile.value);
        onDialogOK();
    }
}
</script>

<style scoped></style>
