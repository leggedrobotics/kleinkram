import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CreateMultipartUploadCommand,
    S3Client,
    UploadPartCommand,
} from '@aws-sdk/client-s3';
import type { TemporaryFileAccessesDto } from '@kleinkram/api-dto/types/file/access.dto';
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import {
    FlatMissionDto,
    MissionDto,
} from '@kleinkram/api-dto/types/mission/mission.dto';
import type { ProjectDto } from '@kleinkram/api-dto/types/project/base-project.dto';
import { FileType } from '@kleinkram/shared';
import { isValidFileName } from '@kleinkram/validation/frontend';
import { QueryClient } from '@tanstack/vue-query';
import { AxiosError } from 'axios';
import pLimit from 'p-limit';
import { Dialog, Notify } from 'quasar';
import SparkMD5 from 'spark-md5';
import RenameFilesDialog from 'src/components/rename-files-dialog.vue';
import {
    cancelUploads,
    confirmUpload,
    importFromDrive as createDrive,
    generateTemporaryCredentials,
} from 'src/services/mutations/file';
import { existsFile } from 'src/services/queries/file';
import { ref, Ref } from 'vue';
import ENV from '../environment';

const confirmDialog = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    event.returnValue = ''; // This triggers the generic browser dialog.
};

export const createFileAction = async (
    selectedMission: FlatMissionDto | undefined,
    selectedProject: ProjectDto | undefined,
    files: File[],
    queryClient: QueryClient,
    uploadingFiles: Ref<Record<string, Record<string, string>>>,
    injectedFiles: Ref<FileWithTopicDto[]>,
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

const VALID_EXTENSIONS = [
    ...Object.values(FileType)
        .filter((type) => type !== FileType.ALL)
        .map((type) => `.${type.toLowerCase()}`),
    '.yml',
];

const VALID_EXTENSION_SET = new Set(VALID_EXTENSIONS);

const isValidFileTypeFilter = (filename: string): boolean => {
    const lastDotIndex = filename.lastIndexOf('.');
    // Check for no extension or hidden files (e.g., .gitignore)
    if (lastDotIndex <= 0) {
        return false;
    }
    const extension = filename.slice(Math.max(0, lastDotIndex)).toLowerCase();
    return VALID_EXTENSION_SET.has(extension);
};

const invalidFileTypeMessage = `Invalid file type. Only ${VALID_EXTENSIONS.join(
    ', ',
)} files are allowed.`;

const hasValidFileSize = (file: File): boolean => {
    const maxSizeInBytes = 50 * 1024 * 1024 * 1024;
    return file.size <= maxSizeInBytes && file.size > 0;
};

const isValidNameFilter = (filename: string): boolean =>
    isValidFileName(filename);

// eslint-disable-next-line complexity
async function _createFileAction(
    selectedMission: FlatMissionDto,
    selectedProject: ProjectDto,
    files: File[],
    queryClient: QueryClient,
    uploadingFiles: Ref<Record<string, Record<string, string>>>,
    injectedFiles: Ref<FileWithTopicDto[]>,
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

    const validFiles = files.filter(
        (file) => isValidFileTypeFilter(file.name) && hasValidFileSize(file),
    );

    ////////////////////////////////////////////////////////////////////////////
    // Display Warning for Invalid Files
    ////////////////////////////////////////////////////////////////////////////
    const invalidFiles = files.filter(
        (file) =>
            !isValidFileTypeFilter(file.name) ||
            !isValidNameFilter(file.name) ||
            !hasValidFileSize(file) ||
            file.name.length > 50,
    );

    if (invalidFiles.length > 0) {
        const invalidFileNameMessage = `Invalid filename. Only alphanumeric characters, underscores, hyphens, dots, spaces, brackets, and umlauts are allowed.`;
        const invalidFileNameLengthMessage = `File name is too long. Maximum length is 50 characters.`;

        const errorMessages: string[] = invalidFiles.map((file) => {
            const errors: string[] = [];

            // Check errors in order of precedence
            if (file.name.length > 50) {
                errors.push(invalidFileNameLengthMessage);
            }
            if (!isValidFileTypeFilter(file.name)) {
                errors.push(invalidFileTypeMessage);
            }
            if (!isValidNameFilter(file.name)) {
                errors.push(invalidFileNameMessage);
            }

            if (!hasValidFileSize(file)) {
                const fileSize = file.size;

                if (fileSize === 0) {
                    errors.push(
                        `File is empty. Please select a file larger than 0 bytes.`,
                    );
                } else {
                    errors.push(
                        `File is too large. Maximum size 50 GB for bigger files, please use the CLI tool.`,
                    );
                }
            }

            return `<b>${file.name}</b>: ${errors.join('; ')}`;
        });

        Notify.create({
            group: false,
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            caption: `Upload of ${invalidFiles.length} file(s) failed:`,
            message: errorMessages.join('<br>'),
            html: true,
            color: 'negative',
            spinner: false,
            position: 'bottom',
            timeout: 30_000,
            closeBtn: true,
        });
    }

    const fileItems = validFiles.map((file) => ({
        file,
        virtualName: file.name,
    }));

    let temporaryCredentials: TemporaryFileAccessesDto | undefined;

    while (!temporaryCredentials) {
        const filenames = fileItems.map((item) => item.virtualName);
        try {
            temporaryCredentials = await generateTemporaryCredentials({
                filenames,
                missionUUID: selectedMission.uuid,
            });
        } catch (error: unknown) {
            let handled = false;
            if (error instanceof AxiosError && error.response?.status === 400) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const responseData = error.response.data;
                // Check for structured error: { message: 'Validation failed', errors: [...] }
                if (
                    responseData &&
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    responseData.message === 'Validation failed' &&
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    Array.isArray(responseData.errors)
                ) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    const invalidFilesList = responseData.errors;
                    try {
                        const renameMap: Record<string, string> =
                            await new Promise((resolve, reject) => {
                                Dialog.create({
                                    component: RenameFilesDialog,
                                    componentProps: {
                                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                                        invalidFiles: invalidFilesList,
                                    },
                                })
                                    .onOk(resolve)
                                    .onCancel(reject)
                                    .onDismiss(reject);
                            });

                        // Update virtual names
                        for (const item of fileItems) {
                            if (renameMap[item.virtualName]) {
                                item.virtualName =
                                    renameMap[item.virtualName] ??
                                    item.virtualName;
                            }
                        }
                        handled = true;
                        // Continue loop to retry
                    } catch {
                        // User cancelled
                        return;
                    }
                }
            }

            if (!handled) {
                console.error('error', error);
                let errorMessage = '';
                if (error instanceof Error) {
                    errorMessage = error.message;
                }
                let message = `Upload failed: ${errorMessage}`;

                if (error instanceof AxiosError) {
                    if (error.response?.status === 403) {
                        message = `Upload failed: You do not have the necessary permissions.`;
                    } else if (error.response?.status === 400) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        const responseData = error.response.data;
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        message = responseData.message
                            ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                              `Upload failed: ${JSON.stringify(responseData.message)}`
                            : `Upload failed: ${JSON.stringify(responseData)}`;
                    }
                }

                Notify.create({
                    message: message,
                    color: 'negative',
                    spinner: false,
                    position: 'bottom',
                    timeout: 30_000,
                    closeBtn: true,
                });
                return;
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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

    uploadingFiles.value = fileItems.map(
        (item) => item.virtualName,
    ) as unknown as Record<string, Record<string, string>>;

    const api = ENV.BACKEND_URL;
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            async (accessResp: any, index: number) => {
                const fileItem = fileItems[index];
                if (!fileItem) return;
                const file = fileItem.file;

                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (file === undefined) {
                    Notify.create({
                        message: `Upload of File failed`,
                        color: 'negative',
                        spinner: false,
                        timeout: 0,
                        closeBtn: true,
                    });
                    return;
                }

                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
                    // Workaround for https://github.com/aws/aws-sdk-js-v3/issues/6834
                    requestChecksumCalculation: 'WHEN_REQUIRED',
                    credentials: {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        accessKeyId: accessCredentials.accessKey,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        secretAccessKey: accessCredentials.secretKey,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        sessionToken: accessCredentials.sessionToken,
                    },
                });

                const newFileUpload = {
                    name: fileItem.virtualName,
                    size: file.size,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    fileUUID: accessResp.fileUUID,
                    missionUuid: selectedMission.uuid,
                } as unknown as FileWithTopicDto;
                const newFileUploadReference = ref(newFileUpload);
                // @ts-ignore
                injectedFiles.value.push(newFileUploadReference);

                return limit(async () => {
                    try {
                        const md5Hash = await uploadFileMultipart(
                            file,
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                            accessResp.bucket,
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                            accessResp.fileUUID,
                            minioClient,
                            newFileUploadReference,
                        );

                        if (md5Hash === undefined) {
                            Notify.create({
                                message: `Upload of File ${file.name} failed`,
                                color: 'negative',
                                spinner: false,
                                timeout: 0,
                                closeBtn: true,
                            });
                            return;
                        }

                        return await confirmUpload(
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                            accessResp.fileUUID,
                            md5Hash,
                        );
                    } catch (error: unknown) {
                        let errorMessage = '';
                        if (error instanceof Error) {
                            errorMessage = error.message;
                        }

                        newFileUploadReference.value.canceled = true;
                        Notify.create({
                            message: `Upload of File ${file.name} failed: ${errorMessage}`,
                            color: 'negative',
                            spinner: false,
                            timeout: 0,
                            closeBtn: true,
                        });
                    } finally {
                        await queryClient.invalidateQueries({
                            queryKey: ['files'],
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
): Promise<boolean> {
    // abort if no mission is selected
    if (selectedMission === undefined) return false;

    return await createDrive(selectedMission.uuid, driveUrl.value)
        .then(() => true)
        .catch((error: unknown) => {
            let errorMessage = '';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            if (error instanceof AxiosError && error.response?.data) {
                const serverMessage = (
                    error.response.data as { message?: string }
                ).message;
                if (serverMessage) {
                    errorMessage = serverMessage;
                    if (
                        errorMessage.includes(
                            'Google Drive Folder ingestion requires',
                        )
                    ) {
                        errorMessage =
                            'Uploading from Google Drive Folder requires a service account';
                    }
                }
            }

            Notify.create({
                message: `Upload failed: ${errorMessage}`,
                color: 'negative',
                spinner: false,
                timeout: 0,
                closeBtn: true,
                html: true,
            });
            return false;
        });
}

async function uploadFileMultipart(
    file: File,
    bucket: string,
    key: string,
    minioClient: S3Client,
    newFileUpload: Ref<FileWithTopicDto>,
): Promise<string | undefined> {
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
        // eslint-disable-next-line no-console
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
            // eslint-disable-next-line no-console
            console.log('Multipart upload aborted.');
        }

        await cancelUploads(
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            [newFileUpload.value.fileUUID],
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            newFileUpload.value.missionUuid ?? '',
        );
    }
}
