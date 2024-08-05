<template>
    <q-card-section>
        <h3 class="text-h6">Create new files</h3>
        <q-form @submit.prevent="submitNewFile">
            <div class="row items-center justify-between q-gutter-md">
                <div class="col-1">
                    <q-btn-dropdown
                        v-model="dropdownNewFileProject"
                        :label="selected_project?.name || 'Project'"
                        outlined
                        dense
                        clearable
                        required
                    >
                        <q-list>
                            <q-item
                                v-for="project in data"
                                :key="project.uuid"
                                clickable
                                @click="
                                    selected_project = project;
                                    dropdownNewFileProject = false;
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
                        v-model="dropdownNewFileMission"
                        :label="selected_mission?.name || 'Mission'"
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
                                    selected_mission = mission;
                                    dropdownNewFileMission = false;
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
                <div class="col-5">
                    <div class="row" style="padding-bottom: 8px">
                        <q-file
                            outlined
                            v-model="files"
                            hint="Upload File"
                            multiple
                            accept=".bag, .mcap"
                            style="min-width: 300px"
                        >
                            <template v-slot:prepend>
                                <q-icon name="sym_o_attach_file" />
                            </template>
                            <template v-slot:append>
                                <q-icon
                                    name="sym_o_cancel"
                                    @click="files = []"
                                />
                            </template>
                        </q-file>
                    </div>
                    <div class="row">
                        <q-input
                            v-model="drive_url"
                            outlined
                            dense
                            clearable
                            hint="Google Drive URL"
                            style="min-width: 300px"
                        />
                    </div>
                </div>
                <div class="col-1">
                    <q-btn
                        label="Submit"
                        color="primary"
                        @click="submitNewFile"
                    />
                </div>
            </div>
        </q-form>
    </q-card-section>
</template>
<script setup lang="ts">
import { computed, Ref, ref, watchEffect } from 'vue';
import { Notify } from 'quasar';

import { useQuery, useQueryClient } from '@tanstack/vue-query';
import axios from 'axios';
import { Project } from 'src/types/Project';
import { Mission } from 'src/types/Mission';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProject } from 'src/services/queries/mission';
import {
    confirmUpload,
    createDrive,
    getUploadURL,
} from 'src/services/mutations/queue';
const selected_project: Ref<Project | null> = ref(null);

const dropdownNewFileProject = ref(false);
const dropdownNewFileMission = ref(false);
const files = ref<File[]>([]);
const selected_mission: Ref<Mission | null> = ref(null);
const { data: _data, error } = useQuery<[Project[], number]>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name'),
});
const data = computed(() => {
    if (_data && _data.value) {
        return _data.value[0];
    }
    return [];
});
const queryClient = useQueryClient();

const drive_url = ref('');

const props = defineProps<{
    mission?: Mission;
}>();

if (props.mission && props.mission.project) {
    selected_project.value = props.mission.project;
    selected_mission.value = props.mission;
}

const { data: _missions, refetch } = useQuery<[Mission[], number]>({
    queryKey: ['missions', selected_project.value?.uuid],
    queryFn: () => missionsOfProject(selected_project.value?.uuid || ''),
    enabled: !!selected_project.value?.uuid,
});
const missions = computed(() => {
    if (_missions && _missions.value) {
        return _missions.value[0];
    }
    return [];
});

watchEffect(() => {
    if (selected_project.value?.uuid) {
        refetch();
    }
});

const submitNewFile = async () => {
    if (!selected_mission.value) {
        return;
    }
    const noti = Notify.create({
        group: false,
        message: 'Processing file...',
        color: 'primary',
        spinner: true,
        position: 'top-right',
        timeout: 0,
    });
    if (files.value && files.value.length > 0) {
        const filesToRecord: Record<string, File> = files.value.reduce(
            (acc, file) => ({ ...acc, [file.name]: file }),
            {},
        );
        const filenames = Object.keys(filesToRecord);
        const filenameRegex = /^[a-zA-Z0-9_\-\. \[\]\(\)äöüÄÖÜ]+$/;
        const filteredFilenames: string[] = [];
        filenames.forEach((filename) => {
            const isBagOrMCAP =
                filename.endsWith('.bag') || filename.endsWith('.mcap');
            const isValidName = filenameRegex.test(filename);
            if (isBagOrMCAP && isValidName) {
                filteredFilenames.push(filename);
            } else {
                if (!isBagOrMCAP) {
                    Notify.create({
                        group: false,
                        message: `Upload of File ${filename} failed: Invalid file type. Only .bag and .mcap files are allowed.`,
                        color: 'negative',
                        spinner: false,
                        position: 'top-right',
                        timeout: 30000,
                        closeBtn: true,
                    });
                } else {
                    Notify.create({
                        group: false,
                        message: `Upload of File ${filename} failed: Invalid filename. Only alphanumeric characters, underscores, hyphens, dots, spaces, brackets, and umlauts are allowed.`,
                        color: 'negative',
                        spinner: false,
                        position: 'top-right',
                        timeout: 30000,
                        closeBtn: true,
                    });
                }
            }
        });
        const urls = await getUploadURL(
            filteredFilenames,
            selected_mission.value.uuid,
        );
        await Promise.all(
            filteredFilenames.map((filename) => {
                const file = filesToRecord[filename];
                if (!urls[filename]) {
                    Notify.create({
                        group: false,
                        message: `Upload of File ${filename} failed: Could not generate Upload URL. Correct file type? Unique filename?`,
                        color: 'negative',
                        spinner: false,
                        position: 'top-right',
                        timeout: 30000,
                        closeBtn: true,
                    });
                    return;
                }
                const uploadURL = urls[filename]['url'];

                // Use axios to upload the file
                return axios
                    .put(uploadURL, file, {
                        headers: {
                            'Content-Type':
                                file.type || 'application/octet-stream',
                        },
                    })
                    .then(async () => {
                        confirmUpload(urls[filename]['uuid'])
                            .then(() => {
                                Notify.create({
                                    message: `File ${filename} uploaded`,
                                    color: 'positive',
                                    spinner: false,
                                    position: 'top-right',
                                    group: false,
                                    timeout: 2000,
                                });
                                files.value = [];
                            })
                            .catch((e) => {
                                Notify.create({
                                    message: `Upload of File ${filename} failed: ${e}`,
                                    color: 'negative',
                                    spinner: false,
                                    position: 'top-right',
                                    group: false,
                                    closeBtn: true,
                                    timeout: 0,
                                });
                            });
                    })
                    .catch((e) => {
                        Notify.create({
                            message: `Upload of File ${filename} failed: ${e}`,
                            color: 'negative',
                            position: 'top-right',
                            group: false,
                            spinner: false,
                            closeBtn: true,
                            timeout: 0,
                        });
                    });
            }),
        );
        noti({
            message: `Files for Mission ${selected_mission.value?.name} uploaded`,
            color: 'positive',
            spinner: false,
            timeout: 5000,
        });
        const cache = queryClient.getQueryCache();
        const filtered = cache
            .getAll()
            .filter(
                (query) =>
                    query.queryKey[0] === 'files' &&
                    query.queryKey[1] === selected_mission.value?.uuid,
            );
        filtered.forEach((query) => {
            console.log('Invalidating query', query.queryKey);
            queryClient.invalidateQueries(query.queryKey);
        });
    } else if (drive_url.value) {
        if (!selected_mission.value) {
            return;
        }
        await createDrive(selected_mission.value.uuid, drive_url.value)
            .then(() => {
                noti({
                    message: `Files for Mission ${selected_mission.value?.name} are now importing...`,
                    color: 'positive',
                    spinner: false,
                    timeout: 5000,
                });
            })
            .catch((e) => {
                noti({
                    message: `Upload of Files for Mission ${selected_mission.value?.name} failed: ${e}`,
                    color: 'negative',
                    spinner: false,
                    timeout: 0,
                    closeBtn: true,
                });
            });
    } else {
        noti({
            message: 'No file or URL provided',
            color: 'negative',
            spinner: false,
            timeout: 2000,
        });
    }
};
</script>
<style scoped></style>
