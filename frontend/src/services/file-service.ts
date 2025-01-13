import { Notify } from 'quasar';
import {
    cancelUploads,
    generateTemporaryCredentials,
} from 'src/services/mutations/file';
import ENV from '../environment';
import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CreateMultipartUploadCommand,
    S3Client,
    UploadPartCommand,
} from '@aws-sdk/client-s3';
import pLimit from 'p-limit';
import { ref, Ref } from 'vue';
import { confirmUpload, createDrive } from 'src/services/mutations/queue';
import { existsFile } from 'src/services/queries/file';
import { QueryClient } from '@tanstack/vue-query';
import SparkMD5 from 'spark-md5';
import { FlatMissionDto, MissionDto } from '@api/types/mission/mission.dto';
import { AxiosError } from 'axios';
import { FileWithTopicDto } from '@api/types/file/file.dto';
import { ProjectDto } from '@api/types/project/base-project.dto';

const confirmDialog = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
    event.returnValue = ''; // This triggers the generic browser dialog.
};

export const createFileAction = async (
    selectedMission: FlatMissionDto | undefined,
    selectedProject: ProjectDto | undefined,
    files: File[],
    queryClient: QueryClient,
    uploadingFiles: Ref<Record<string, Record<string, string>>>,
    injectedFiles: Ref<Ref<FileWithTopicDto>[]>,
): Promise<void> => {
    if (selectedMission === undefined) {
        Notify.create({
            message: 'No mission selected',
            color: 'negative',
            spinner: false,
            timeout: 2000,
        });
        return;
    } else if (selectedProject === undefined) {
        Notify.create({
            message: 'No project selected',
            color: 'negative',
            spinner: false,
            timeout: 2000,
        });
        return;
    }

    window.addEventListener('beforeunload', confirmDialog);

    return _createFileAction(
        selectedMission,
        selectedProject,
        files,
        queryClient,
        uploadingFiles,
        injectedFiles,
    ).finally(() => {
        window.removeEventListener('beforeunload', confirmDialog);
    });
};

const isBagOrMCAPFilter = (filename: string): boolean =>
    filename.endsWith('.bag') || filename.endsWith('.mcap');

async function _createFileAction(
    selectedMission: FlatMissionDto,
    selectedProject: ProjectDto,
    files: File[],
    queryClient: QueryClient,
    uploadingFiles: Ref<Record<string, Record<string, string>>>,
    injectedFiles: Ref<Ref<FileWithTopicDto>[]>,
): Promise<void> {
    if (files.length === 0) {
        Notify.create({
            message: 'No file or URL provided',
            color: 'negative',
            spinner: false,
            timeout: 2000,
        });
        return;
    }

    const filenameRegex = /^[a-zA-Z0-9_\-. [\]()äöüÄÖÜ]+$/;
    const isValidNameFilter = (filename: string): boolean =>
        filenameRegex.test(filename);

    const validFiles = files.filter(
        (file) =>
            isBagOrMCAPFilter(file.name) &&
            isValidNameFilter(file.name) &&
            file.name.length <= 50,
    );

    ////////////////////////////////////////////////////////////////////////////
    // Display Warning for Invalid Files
    ////////////////////////////////////////////////////////////////////////////
    const invalidFiles = files.filter(
        (file) =>
            !isBagOrMCAPFilter(file.name) ||
            !isValidNameFilter(file.name) ||
            file.name.length > 50,
    );

    if (invalidFiles.length > 0) {
        let message = `Upload of following Files failed: `;
        const invalidFileTypeMessage = `Invalid file type. Only .bag and .mcap files are allowed.`;
        const invalidFileNameMessage = `Invalid filename. Only alphanumeric characters, underscores, hyphens, dots, spaces, brackets, and umlauts are allowed.`;
        const invalidFileNameLengthMessage = `File name is too long. Maximum length is 50 characters.`;
        for (const file of invalidFiles) {
            if (file.name.length > 50) {
                message += `${file.name}: ${invalidFileNameLengthMessage}`;
            }
            if (!isBagOrMCAPFilter(file.name)) {
                message += `${file.name}: ${invalidFileTypeMessage}`;
            }
            if (!isValidNameFilter(file.name)) {
                message += `${file.name}: ${invalidFileNameMessage}`;
            }
        }
        Notify.create({
            group: false,
            message,
            color: 'negative',
            spinner: false,
            position: 'bottom',
            timeout: 30_000,
            closeBtn: true,
        });
    }

    const fileNames = validFiles.map((file) => file.name);
    const temporaryCredentials = await generateTemporaryCredentials(
        fileNames,
        selectedMission.uuid,
    ).catch((error: unknown) => {
        console.error('error', error);

        let errorMessage = '';

        if (error instanceof Error) {
            errorMessage = error.message;
        }

        let message = `Upload failed: ${errorMessage}`;

        // show special error for 403
        if (error instanceof AxiosError) {
            if (error.response?.status === 403) {
                message = `Upload failed: You do not have the necessary permissions.`;
            } else if (error.response?.status === 400) {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                message = `Upload failed: ${error.response.data.message}`;
            }
        }

        // close the notification
        Notify.create({
            message: message,
            color: 'negative',
            spinner: false,
            position: 'bottom',
            timeout: 30_000,
            closeBtn: true,
        });
    });

    if (!temporaryCredentials) {
        return;
    }

    // reset query key isUploading
    await queryClient.invalidateQueries({
        queryKey: ['isUploading'],
    });

    Notify.create({
        message: "Upload started, don't close the tab",
        color: 'positive',
        spinner: false,
        timeout: 2000,
    });

    uploadingFiles.value = fileNames as unknown as Record<
        string,
        Record<string, string>
    >;

    const api = ENV.ENDPOINT;
    let minioEndpoint = api.replace('api', 'minio');
    if (api === 'http://localhost:3000') {
        minioEndpoint = 'http://localhost:9000';
    }

    await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'files',
    });

    const limit = pLimit(5);

    await Promise.all(
        temporaryCredentials.data.map(
            async (accessResp: any, index: number) => {
                const file = validFiles[index];

                const accessCredentials = accessResp.accessCredentials;
                if (accessCredentials === null) {
                    Notify.create({
                        message: `Upload of File ${file.name} failed: Does the file already exist?`,
                        color: 'negative',
                        spinner: false,
                        timeout: 0,
                        closeBtn: true,
                    });
                    return;
                }

                const minioClient = new S3Client({
                    endpoint: minioEndpoint,
                    forcePathStyle: true,
                    region: 'us-east-1',
                    credentials: {
                        accessKeyId: accessCredentials.accessKey,
                        secretAccessKey: accessCredentials.secretKey,
                        sessionToken: accessCredentials.sessionToken,
                    },
                });

                const newFileUpload = {
                    name: file.name,
                    size: file.size,
                    fileUUID: accessResp.fileUUID,
                    uuid: selectedMission.uuid,
                } as unknown as FileWithTopicDto;
                const newFileUploadReference = ref(newFileUpload);
                injectedFiles.value.push(newFileUploadReference);
                return limit(async () => {
                    try {
                        const md5Hash = await uploadFileMultipart(
                            file,
                            accessResp.bucket,
                            accessResp.fileUUID,
                            minioClient,
                            newFileUploadReference,
                        );

                        return await confirmUpload(
                            accessResp.fileUUID,
                            md5Hash,
                        );
                    } catch (error: unknown) {
                        let errorMessage = '';
                        if (error instanceof Error) {
                            errorMessage = error.message;
                        }

                        console.error('err', error);
                        newFileUploadReference.value.canceled = true;
                        Notify.create({
                            message: `Upload of File ${file.name} failed: ${errorMessage}`,
                            color: 'negative',
                            spinner: false,
                            timeout: 0,
                            closeBtn: true,
                        });
                    }
                    return;
                });
            },
        ),
    );

    Notify.create({
        message: `Files for Mission ${selectedMission.name} uploaded`,
        color: 'positive',
        spinner: false,
        timeout: 5000,
    });
    await queryClient.invalidateQueries({
        predicate: (query) =>
            (query.queryKey[0] === 'files' &&
                query.queryKey[1] === selectedMission.uuid) ||
            (query.queryKey[0] === 'missions' &&
                query.queryKey[1] === selectedProject.uuid) ||
            (query.queryKey[0] === 'projects' &&
                query.queryKey[1] === selectedProject.uuid),
    });
}

/**
 * Import files from Google Drive.
 *
 * @param selectedMission the mission to import the files into
 * @param driveUrl the URL of the Google Drive folder to import
 */
export async function driveUpload(
    selectedMission: MissionDto | undefined,
    driveUrl: Ref<string>,
): Promise<void> {
    // abort if no mission is selected
    if (selectedMission === undefined) return;

    const notification = Notify.create({
        group: false,
        message: 'Processing files...',
        color: 'positive',
        spinner: true,
        position: 'bottom',
        timeout: 0,
    });

    await createDrive(selectedMission.uuid, driveUrl.value)
        .then(() => {
            notification({
                message: `Files for Mission ${selectedMission.name} are now importing...`,
                color: 'positive',
                spinner: false,
                timeout: 5000,
            });
        })
        .catch((error: unknown) => {
            let errorMessage = '';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            notification({
                message: `Upload of Files for Mission ${selectedMission.name} failed: ${errorMessage}`,
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
    newFileUpload: Ref<FileWithTopicDto>,
): Promise<string> {
    let uploadId: string | undefined;
    try {
        const createMultipartUploadCommand = new CreateMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
        });
        const { UploadId: _uploadID } = await minioClient.send(
            createMultipartUploadCommand,
        );
        uploadId = _uploadID;

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
                UploadId: uploadId,
                Body: partBlob,
            });
            const maxRetries = 60;
            let retries = 0;
            while (retries < maxRetries) {
                try {
                    const { ETag } = await minioClient.send(uploadPartCommand);
                    newFileUpload.value.uploaded =
                        (newFileUpload.value.uploaded ?? 0) + partBlob.size;

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
                UploadId: uploadId,
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
        if (uploadId !== undefined) {
            const abortMultipartUploadCommand = new AbortMultipartUploadCommand(
                {
                    Bucket: bucket,
                    Key: key,
                    UploadId: uploadId,
                },
            );
            await minioClient.send(abortMultipartUploadCommand);
            console.log('Multipart upload aborted.');
        }

        await cancelUploads(
            [newFileUpload.value.uuid],
            newFileUpload.value.missionUuid ?? '',
        );

        throw error;
    }
}
