<template>
    <q-card-section>
        <label>Project*</label>

        <q-btn-dropdown
            v-model="dropdownNewFileProject"
            :disable="!!props?.mission?.project"
            :label="selected_project?.name || 'Project'"
            class="q-uploader--bordered full-width full-height q-mb-lg"
            flat
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

        <label>Mission*</label>

        <q-btn-dropdown
            v-model="dropdownNewFileMission"
            :disable="!!props?.mission"
            :label="selected_mission?.name || 'Mission'"
            class="q-uploader--bordered full-width full-height q-mb-lg"
            flat
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

        <label>Upload File from Device</label>
        <q-file
            outlined
            v-model="files"
            multiple
            accept=".bag, .mcap"
            style="min-width: 300px"
        >
            <template #prepend>
                <q-icon name="sym_o_attach_file" />
            </template>

            <template #append>
                <q-icon name="sym_o_cancel" @click="files = []" />
            </template>
        </q-file>

        <br />

        <label>Import File from Google Drive</label>

        <q-input
            v-model="drive_url"
            outlined
            dense
            clearable
            placholder="Google Drive Link"
            style="min-width: 300px"
        />
    </q-card-section>
</template>
<script setup lang="ts">
import { computed, Ref, ref, watchEffect } from 'vue';
import { Notify } from 'quasar';

import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Project } from 'src/types/Project';
import { Mission } from 'src/types/Mission';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProject } from 'src/services/queries/mission';
import { confirmUpload, createDrive } from 'src/services/mutations/queue';
import { generateTemporaryCredentials } from 'src/services/mutations/file';
import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CreateMultipartUploadCommand,
    S3Client,
    UploadPartCommand,
} from '@aws-sdk/client-s3';

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

const createFileAction = async () => {
    if (!selected_mission.value) {
        return;
    }
    const noti = Notify.create({
        group: false,
        message: 'Processing file...',
        color: 'primary',
        spinner: true,
        position: 'bottom',
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
                        position: 'bottom',
                        timeout: 30000,
                        closeBtn: true,
                    });
                } else {
                    Notify.create({
                        group: false,
                        message: `Upload of File ${filename} failed: Invalid filename. Only alphanumeric characters, underscores, hyphens, dots, spaces, brackets, and umlauts are allowed.`,
                        color: 'negative',
                        spinner: false,
                        position: 'bottom',
                        timeout: 30000,
                        closeBtn: true,
                    });
                }
            }
        });
        const { credentials, files: reservedFilenames } =
            await generateTemporaryCredentials(
                filteredFilenames,
                selected_mission.value.uuid,
            ).catch((e) => {
                let msg = `Upload of Files failed: ${e}`;

                // show special error for 403
                if (e.response && e.response.status === 403) {
                    msg = `Upload of Files failed: You do not have permission to upload files for Mission ${selected_mission.value?.name}`;
                }

                // close the notification
                noti({
                    message: msg,
                    color: 'negative',
                    spinner: false,
                    position: 'top-right',
                    timeout: 30000,
                    closeBtn: true,
                });
            });
        const minioClient = new S3Client({
            endpoint: 'http://localhost:9000',
            forcePathStyle: true,
            region: 'us-east-1',
            credentials: {
                accessKeyId: credentials.accessKey,
                secretAccessKey: credentials.secretKey,
                sessionToken: credentials.sessionToken,
            },
        });

        await Promise.all(
            Object.keys(reservedFilenames).map(async (filename) => {
                const file = filesToRecord[filename];

                try {
                    await uploadFileMultipart(
                        file,
                        reservedFilenames[filename].bucket,
                        reservedFilenames[filename].location,
                        minioClient,
                    );
                    noti({
                        message: `File ${filename} uploaded`,
                        color: 'positive',
                        spinner: false,
                        timeout: 5000,
                    });
                    return confirmUpload(reservedFilenames[filename].queueUUID);
                } catch (e) {
                    noti({
                        message: `Upload of File ${filename} failed: ${e}`,
                        color: 'negative',
                        spinner: false,
                        timeout: 0,
                        closeBtn: true,
                    });
                }
                return;
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
                    (query.queryKey[0] === 'files' &&
                        query.queryKey[1] === selected_mission.value?.uuid) ||
                    (query.queryKey[0] === 'missions' &&
                        query.queryKey[1] === selected_project.value?.uuid) ||
                    (query.queryKey[0] === 'projects' &&
                        query.queryKey[1] === selected_project.value?.uuid),
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

async function uploadFileMultipart(
    file: File,
    bucket: string,
    key: string,
    minioClient: S3Client,
) {
    try {
        // Step 1: Initiate Multipart Upload
        const createMultipartUploadCommand = new CreateMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
        });
        const { UploadId } = await minioClient.send(
            createMultipartUploadCommand,
        );

        // Step 2: Upload Parts
        const partSize = 50 * 1024 * 1024; // 5 MB per part (adjust as needed)
        const parts = [];
        for (
            let partNumber = 1, start = 0;
            start < file.size;
            partNumber++, start += partSize
        ) {
            const end = Math.min(start + partSize, file.size);
            const partBlob = file.slice(start, end);
            const uploadPartCommand = new UploadPartCommand({
                Bucket: bucket,
                Key: key,
                PartNumber: partNumber,
                UploadId,
                Body: partBlob,
            });
            const { ETag } = await minioClient.send(uploadPartCommand);
            parts.push({ PartNumber: partNumber, ETag });
        }

        // Step 3: Complete Multipart Upload
        const completeMultipartUploadCommand =
            new CompleteMultipartUploadCommand({
                Bucket: bucket,
                Key: key,
                UploadId,
                MultipartUpload: { Parts: parts },
            });
        return await minioClient.send(completeMultipartUploadCommand);
    } catch (error) {
        console.error('Multipart upload failed:', error);

        // Step 4 (Optional): Abort Multipart Upload
        if (UploadId) {
            const abortMultipartUploadCommand = new AbortMultipartUploadCommand(
                {
                    Bucket: bucket,
                    Key: key,
                    UploadId,
                },
            );
            await minioClient.send(abortMultipartUploadCommand);
            console.log('Multipart upload aborted.');
        }

        throw error;
    }
}

defineExpose({
    createFileAction,
});
</script>
<style scoped></style>
