<template>
    <q-dialog ref="dialogRef" style="max-width: 1500px">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 300px; max-width: 1500px"
        >
            <q-card-section>
                <h4>Edit file {{ isLoading ? '...' : data?.filename }}</h4>
                <q-form v-if="editableFile">
                    <div class="row items-center justify-between q-gutter-md">
                        <div class="col-5">
                            <q-input
                                v-model="editableFile.filename"
                                label="Name"
                                outlined
                                dense
                                clearable
                                required
                            />
                        </div>
                        <div class="col-1">
                            <q-btn-dropdown
                                v-model="dd_open"
                                :label="selected_project?.name || 'Project'"
                                outlined
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
                        <div class="col-1">
                            <q-btn-dropdown
                                v-model="dd_open_2"
                                :label="editableFile?.mission.name || 'Mission'"
                                outlined
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
                        <div class="col-3">
                            <div class="q-pa-md" style="max-width: 300px">
                                <q-input filled v-model="dateTime">
                                    <template v-slot:prepend>
                                        <q-icon
                                            name="sym_o_event"
                                            class="cursor-pointer"
                                        >
                                            <q-popup-proxy
                                                cover
                                                transition-show="scale"
                                                transition-hide="scale"
                                            >
                                                <q-date
                                                    v-model="dateTime"
                                                    mask="DD.MM.YYYY HH:mm"
                                                >
                                                    <div
                                                        class="row items-center justify-end"
                                                    >
                                                        <q-btn
                                                            v-close-popup
                                                            label="Close"
                                                            color="primary"
                                                            flat
                                                        />
                                                    </div>
                                                </q-date>
                                            </q-popup-proxy>
                                        </q-icon>
                                    </template>

                                    <template v-slot:append>
                                        <q-icon
                                            name="sym_o_access_time"
                                            class="cursor-pointer"
                                        >
                                            <q-popup-proxy
                                                cover
                                                transition-show="scale"
                                                transition-hide="scale"
                                            >
                                                <q-time
                                                    v-model="dateTime"
                                                    mask="DD.MM.YYYY HH:mm"
                                                    format24h
                                                >
                                                    <div
                                                        class="row items-center justify-end"
                                                    >
                                                        <q-btn
                                                            v-close-popup
                                                            label="Close"
                                                            color="primary"
                                                            flat
                                                        />
                                                    </div>
                                                </q-time>
                                            </q-popup-proxy>
                                        </q-icon>
                                    </template>
                                </q-input>
                            </div>
                        </div>
                    </div>
                    <div style="float: right">
                        <q-btn
                            label="Cancel"
                            color="red"
                            @click="onDialogCancel"
                            class="q-mr-sm"
                        />
                        <q-btn
                            label="Save"
                            color="primary"
                            :disable="
                                !dateTime ||
                                !editableFile ||
                                !editableFile.mission ||
                                !editableFile.filename
                            "
                            @click="_updateMission"
                        />
                    </div>
                </q-form>
            </q-card-section>
        </q-card>
    </q-dialog>
</template>
<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';

import { computed, Ref, ref, watch, watchEffect } from 'vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { formatDate, parseDate } from 'src/services/dateFormating';
import { Project } from 'src/types/Project';
import { FileEntity } from 'src/types/FileEntity';
import { fetchFile } from 'src/services/queries/file';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProject } from 'src/services/queries/mission';
import { updateFile } from 'src/services/mutations/file';
import { Mission } from 'src/types/Mission';

const props = defineProps<{
    file_uuid: string;
}>();

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
    useDialogPluginComponent();
const queryClient = useQueryClient();

const dd_open = ref(false);
const dd_open_2 = ref(false);
const selected_project = ref<Project | null | undefined>(null);
const { isLoading, isError, data, error } = useQuery({
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
                newValue.createdAt,
                newValue.updatedAt,
                newValue.deletedAt,
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
    queryFn: () => missionsOfProject(selected_project.value?.uuid || ''),
    enabled: !!selected_project.value?.uuid,
});
const missions = computed(() => (_missions.value ? _missions.value[0] : []));

watch(
    () => selected_project.value,
    (newValue) => {
        if (newValue) {
            refetch().then(() => {
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
    onSuccess: function (data, variables, context) {
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

        filtered.forEach((query) => {
            queryClient.invalidateQueries({ queryKey: query.queryKey });
        });
    },
    onError(error, variables, context) {
        console.log(error);
        Notify.create({
            group: false,
            message: 'Error updating file: ' + error.response.data.message,
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
