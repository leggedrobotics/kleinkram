<template>
    <q-dialog ref="dialogRef" persistent style="max-width: 1500px">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 300px; max-width: 1500px"
        >
            <q-card-section>
                <h4>Edit file {{ isLoading ? '...' : data?.name }}</h4>
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
                                :label="editableFile.mission.name || 'Mission'"
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
                                            name="event"
                                            class="cursor-pointer"
                                        >
                                            <q-popup-proxy
                                                cover
                                                transition-show="scale"
                                                transition-hide="scale"
                                            >
                                                <q-date
                                                    v-model="dateTime"
                                                    mask="YYYY-MM-DD HH:mm"
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
                                            name="access_time"
                                            class="cursor-pointer"
                                        >
                                            <q-popup-proxy
                                                cover
                                                transition-show="scale"
                                                transition-hide="scale"
                                            >
                                                <q-time
                                                    v-model="dateTime"
                                                    mask="YYYY-MM-DD HH:mm"
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
import {
    Query,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/vue-query';

import { Ref, ref, watch, watchEffect } from 'vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { formatDate, parseDate } from 'src/services/dateFormating';
import { Project } from 'src/types/Project';
import { FileEntity } from 'src/types/FileEntity';
import { fetchFile } from 'src/services/queries/file';
import { allProjects } from 'src/services/queries/project';
import { missionsOfProject } from 'src/services/queries/mission';
import { updateFile } from 'src/services/mutations/file';

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
        selected_project.value = newValue?.mission.project;
        if (newValue?.date && data.value) {
            editableFile.value = new FileEntity(
                newValue.uuid,
                newValue.filename,
                newValue.mission.clone(),
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
const projectsReturn = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: allProjects,
});
const projects = projectsReturn.data;

const { data: missions, refetch } = useQuery({
    queryKey: ['missions', selected_project.value?.uuid],
    queryFn: () => missionsOfProject(selected_project.value?.uuid || ''),
    enabled: !!selected_project.value?.uuid,
});

watch(
    () => selected_project.value,
    (newValue) => {
        if (newValue) {
            refetch().then(() => {
                if (
                    editableFile.value &&
                    missions.value?.length !== undefined &&
                    missions.value?.length > 0 &&
                    editableFile.value?.mission.project.uuid !==
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
        // queryClient.invalidateQueries([''])
        Notify.create({
            group: false,
            message: 'File updated',
            color: 'positive',
            spinner: false,
            position: 'top-right',
            timeout: 3000,
        });
        const cache = queryClient.getQueryCache();
        const filtered = cache
            .getAll()
            .filter((query) => query.queryKey[0] === 'Filtered Files');
        filtered.forEach((query) => {
            queryClient.invalidateQueries(query.queryKey);
        });
    },
    onError(error, variables, context) {
        console.log(error);
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
        const noncircularMission = editableFile.value?.mission.clone();
        noncircularMission.project = undefined;
        noncircularMission.files = [];
        editableFile.value.mission = noncircularMission;
        updateFileMutation(editableFile.value);
        onDialogOK();
    }
}
</script>

<style scoped></style>
