import { Notify } from 'quasar';
import {
    cancelUploads,
    generateTemporaryCredentials,
    GenerateTemporaryCredentialsResponse,
} from 'src/services/mutations/file';
import ENV from 'src/env';
import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CreateMultipartUploadCommand,
    S3Client,
    UploadPartCommand,
} from '@aws-sdk/client-s3';
import pLimit from 'p-limit';
import { ref, Ref } from 'vue';
import { FileUpload } from 'src/types/FileUpload';
import { confirmUpload, createDrive } from 'src/services/mutations/queue';
import { existsFile } from 'src/services/queries/file';
import { Mission } from 'src/types/Mission';
import { QueryClient } from '@tanstack/vue-query';
import { Project } from 'src/types/Project';
import SparkMD5 from 'spark-md5';

export async function createFileAction(
    selected_mission: Mission,
    selected_project: Project,
    files: File[],
    queryClient: QueryClient,
    uploadingFiles: Ref<Record<string, Record<string, string>>>,
    injectedFiles: Ref<FileUpload[]>,
) {
    if (!selected_mission) {
        return;
    }
    const noti = Notify.create({
        group: false,
        message: 'Processing files...',
        color: 'positive',
        spinner: true,
        position: 'bottom',
        timeout: 0,
    });
    if (files && files.length > 0) {
        console.log(files);
        const filesToRecord: Record<string, File> = files.reduce(
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
        const tempCreds: GenerateTemporaryCredentialsResponse =
            await generateTemporaryCredentials(
                filteredFilenames,
                selected_mission.uuid,
            ).catch((e) => {
                let msg = `Upload of Files failed: ${e}`;

                // show special error for 403
                if (e.response && e.response.status === 403) {
                    msg = `Upload of Files failed: You do not have permission to upload files for Mission ${selected_mission?.name}`;
                }

                // close the notification
                noti({
                    message: msg,
                    color: 'negative',
                    spinner: false,
                    position: 'bottom',
                    timeout: 30000,
                    closeBtn: true,
                });
            });
        uploadingFiles.value = filteredFilenames;
        const api = ENV.ENDPOINT;
        let minio_endpoint = api.replace('api', 'minio');
        if (api === 'http://localhost:3000') {
            minio_endpoint = 'http://localhost:9000';
        }

        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'files',
        });

        const limit = pLimit(5);

        const zip = (a, b) => a.map((k, i) => [k, b[i]]);
        await Promise.all(
            zip(tempCreds, files).map(async (_file) => {
                const file_access = _file[0];
                const file = _file[1];

                const credentials = file_access.accessCredentials;
                const minioClient = new S3Client({
                    endpoint: minio_endpoint,
                    forcePathStyle: true,
                    region: 'us-east-1',
                    credentials: {
                        accessKeyId: credentials.accessKey,
                        secretAccessKey: credentials.secretKey,
                        sessionToken: credentials.sessionToken,
                    },
                });

                const newFileUpload = ref(
                    new FileUpload(file.filename, file.size),
                );
                injectedFiles.value.push(newFileUpload);
                return limit(async () => {
                    try {
                        const md5Hash = await uploadFileMultipart(
                            file,
                            file_access.bucket,
                            file_access.fileUUID,
                            minioClient,
                            newFileUpload,
                            file_access.fileUUID,
                        );

                        return confirmUpload(file_access.fileUUID, md5Hash);
                    } catch (e) {
                        console.error('err', e);
                        newFileUpload.value.canceled = true;
                        Notify.create({
                            message: `Upload of File ${filename} failed: ${e}`,
                            color: 'negative',
                            spinner: false,
                            timeout: 0,
                            closeBtn: true,
                        });
                    }
                    return;
                });
            }),
        );

        noti({
            message: `Files for Mission ${selected_mission?.name} uploaded`,
            color: 'positive',
            spinner: false,
            timeout: 5000,
        });
        await queryClient.invalidateQueries({
            predicate: (query) =>
                (query.queryKey[0] === 'files' &&
                    query.queryKey[1] === selected_mission.uuid) ||
                (query.queryKey[0] === 'missions' &&
                    query.queryKey[1] === selected_project.uuid) ||
                (query.queryKey[0] === 'projects' &&
                    query.queryKey[1] === selected_project.uuid),
        });
    } else {
        noti({
            message: 'No file or URL provided',
            color: 'negative',
            spinner: false,
            timeout: 2000,
        });
    }
}

/**
 * Import files from Google Drive.
 *
 * @param selected_mission the mission to import the files into
 * @param drive_url the URL of the Google Drive folder to import
 */
export async function driveUpload(
    selected_mission: Mission,
    drive_url: Ref<string>,
) {
    // abort if no mission is selected
    if (!selected_mission) return;

    const noti = Notify.create({
        group: false,
        message: 'Processing files...',
        color: 'positive',
        spinner: true,
        position: 'bottom',
        timeout: 0,
    });

    await createDrive(selected_mission.uuid, drive_url.value)
        .then(() => {
            noti({
                message: `Files for Mission ${selected_mission?.name} are now importing...`,
                color: 'positive',
                spinner: false,
                timeout: 5000,
            });
        })
        .catch((e) => {
            noti({
                message: `Upload of Files for Mission ${selected_mission?.name} failed: ${e}`,
                color: 'negative',
                spinner: false,
                timeout: 0,
                closeBtn: true,
            });
        });
}

async function uploadFileMultipart(
    file: File,
    bucket: string,
    key: string,
    minioClient: S3Client,
    newFileUpload: Ref<FileUpload>,
) {
    let UploadId: string | undefined;
    try {
        const createMultipartUploadCommand = new CreateMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
        });
        const { UploadId: _uploadID } = await minioClient.send(
            createMultipartUploadCommand,
        );
        UploadId = _uploadID;

        const partSize = 50 * 1024 * 1024; // 50 MB per part
        const parts = [];
        const spark = new SparkMD5.ArrayBuffer();
        for (
            let partNumber = 1, start = 0;
            start < file.size;
            partNumber++, start += partSize
        ) {
            if ((partNumber - 1) % 20 === 0) {
                const queueExists = await existsFile(key);
                if (!queueExists) {
                    throw new Error('Upload was cancelled');
                }
            }
            const end = Math.min(start + partSize, file.size);
            const partBlob = file.slice(start, end);

            const partBuffer = await partBlob.arrayBuffer();
            spark.append(partBuffer);

            const uploadPartCommand = new UploadPartCommand({
                Bucket: bucket,
                Key: key,
                PartNumber: partNumber,
                UploadId,
                Body: partBlob,
            });
            const maxRetries = 60;
            let retries = 0;
            while (retries < maxRetries) {
                try {
                    const { ETag } = await minioClient.send(uploadPartCommand);
                    newFileUpload.value.uploaded += partBlob.size;
                    parts.push({ PartNumber: partNumber, ETag });
                    break;
                } catch (error) {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                    console.error('Error uploading part:', error);
                    retries++;
                    if (retries === maxRetries) {
                        throw error;
                    }
                }
            }
        }

        // Step 3: Complete Multipart Upload
        const completeMultipartUploadCommand =
            new CompleteMultipartUploadCommand({
                Bucket: bucket,
                Key: key,
                UploadId,
                MultipartUpload: { Parts: parts },
            });
        const finalMD5 = btoa(spark.end(true));
        console.log('Final MD5:', finalMD5);
        await minioClient.send(completeMultipartUploadCommand);
        return finalMD5;
    } catch (error) {
        console.error('Multipart upload failed:', error);
        newFileUpload.value.canceled = true;

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
        await cancelUploads([fileUUID], selected_mission?.uuid);

        throw error;
    }
}

export function getOnMount(
    uploadingFiles: Ref<Record<string, Record<string, string>>>,
    selected_mission: Ref<Mission | null>,
) {
    return () => {
        window.addEventListener('beforeunload', async (e) => {
            let isDone = false;
            const uuids = Object.keys(uploadingFiles.value).map(
                (filename) => uploadingFiles.value[filename].fileUUID,
            );

            cancelUploads(uuids, selected_mission.value?.uuid)
                .then(() => {
                    isDone = true;
                })
                .catch(() => {
                    isDone = true;
                });
            const start = Date.now();
            while (!isDone && Date.now() - start < 200) {}
        });
    };
}
