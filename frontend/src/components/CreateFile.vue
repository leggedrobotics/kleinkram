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
                        v-model="dropdownNewFileRun"
                        :label="selected_run?.name || 'Run'"
                        outlined
                        dense
                        clearable
                        required
                    >
                        <q-list>
                            <q-item
                                v-for="run in runs"
                                :key="run.uuid"
                                clickable
                                @click="
                                    selected_run = run;
                                    dropdownNewFileRun = false;
                                "
                            >
                                <q-item-section>
                                    <q-item-label>
                                        {{ run.name }}
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
                        >
                            <template v-slot:prepend>
                                <q-icon name="attach_file" />
                            </template>
                            <template v-slot:append>
                                <q-icon name="cancel" @click="files = []" />
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
import { Ref, ref, watchEffect } from 'vue';
import { Notify } from 'quasar';
import {
    confirmUpload,
    createDrive,
    createFile,
    createRun,
    getUploadURL,
} from 'src/services/mutations';
import { Project, Run } from 'src/types/types';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { allProjects, runsOfProject } from 'src/services/queries';
import axios from 'axios';

const dropdownNewFileProject = ref(false);
const dropdownNewFileRun = ref(false);
const files = ref<File[]>([]);
const selected_project: Ref<Project | null> = ref(null);
const selected_run: Ref<Run | null> = ref(null);
const { isLoading, isError, data, error } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: allProjects,
});
const queryClient = useQueryClient();

const drive_url = ref('');

const props = defineProps<{
    run?: Run;
}>();

if (props.run && props.run.project) {
    selected_project.value = props.run.project;
    selected_run.value = props.run;
}

const { data: runs, refetch } = useQuery({
    queryKey: ['runs', selected_project.value?.uuid],
    queryFn: () => runsOfProject(selected_project.value?.uuid || ''),
    enabled: !!selected_project.value?.uuid,
});

watchEffect(() => {
    if (selected_project.value?.uuid) {
        refetch();
    }
});

const submitNewFile = async () => {
    if (!selected_run.value) {
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
        const urls = await getUploadURL(filenames, selected_run.value.uuid);
        await Promise.all(
            filenames.map((filename) => {
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
                const uploadURL = urls[filename];

                // Use axios to upload the file
                return axios
                    .put(uploadURL, file, {
                        headers: {
                            'Content-Type':
                                file.type || 'application/octet-stream',
                        },
                    })
                    .then(async () => {
                        confirmUpload(filename)
                            .then(() => {
                                Notify.create({
                                    message: `File ${filename} uploaded`,
                                    color: 'positive',
                                    spinner: false,
                                    position: 'top-right',
                                    group: false,
                                    timeout: 2000,
                                });
                            })
                            .catch((e) => {
                                Notify.create({
                                    message: `Upload of File ${filename} failed: ${e}`,
                                    color: 'negative',
                                    spinner: false,
                                    position: 'top-right',
                                    group: false,
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
                            timeout: 0,
                        });
                    });
            }),
        );
        noti({
            message: `Files for Run ${selected_run.value?.name} uploaded`,
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
                    query.queryKey[1] === selected_run.value?.uuid,
            );
        filtered.forEach((query) => {
            console.log('Invalidating query', query.queryKey);
            queryClient.invalidateQueries(query.queryKey);
        });
    } else if (drive_url.value) {
        if (!selected_run.value) {
            return;
        }
        await createDrive(selected_run.value.uuid, drive_url.value)
            .then(() => {
                noti({
                    message: `Files for Run ${selected_run.value?.name} are now importing...`,
                    color: 'positive',
                    spinner: false,
                    timeout: 5000,
                });
            })
            .catch((e) => {
                noti({
                    message: `Upload of Files for Run ${selected_run.value?.name} failed: ${e}`,
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
