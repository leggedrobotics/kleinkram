import { Notify } from 'quasar';
import {
    cancelUploads,
    generateTemporaryCredentials,
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
import { confirmUpload, createDrive } from 'src/services/mutations/queue';
import { existsFile } from 'src/services/queries/file';
import { QueryClient } from '@tanstack/vue-query';
import SparkMD5 from 'spark-md5';
import { FlatMissionDto } from '@api/types/Mission.dto';
import { BaseProjectDto } from '@api/types/Project.dto';
import { FileDto } from '@api/types/Files.dto';
import { AxiosError } from 'axios';

export const createFileAction = async (
    selectedMission: FlatMissionDto | null,
    selectedProject: BaseProjectDto | null,
    files: File[],
    queryClient: QueryClient,
    uploadingFiles: Ref<Record<string, Record<string, string>>>,
    injectedFiles: Ref<Ref<FileDto>[]>,
): Promise<void> => {
    if (selectedMission === null) {
        Notify.create({
            message: 'No mission selected',
            color: 'negative',
            spinner: false,
            timeout: 2000,
        });
        return;
    } else if (selectedProject === null) {
        Notify.create({
            message: 'No project selected',
            color: 'negative',
            spinner: false,
            timeout: 2000,
        });
        return;
    }

    const confirmDialog = (e: BeforeUnloadEvent): void => {
        e.preventDefault();
        e.returnValue = ''; // This triggers the generic browser dialog.
    };

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

async function _createFileAction(
    selectedMission: FlatMissionDto,
    selectedProject: BaseProjectDto,
    files: File[],
    queryClient: QueryClient,
    uploadingFiles: Ref<Record<string, Record<string, string>>>,
    injectedFiles: Ref<Ref<FileDto>[]>,
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

    Notify.create({
        message: "Upload started, don't close the tab",
        color: 'positive',
        spinner: false,
        timeout: 2000,
    });

    const isBagOrMCAPFilter = (filename: string): boolean =>
        filename.endsWith('.bag') || filename.endsWith('.mcap');

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
        let errorMessage = '';

        if (error instanceof Error) {
            errorMessage = error.message;
        }

        let message = `Upload of Files failed: ${errorMessage}`;

        // show special error for 403
        if (error instanceof AxiosError && error.response?.status === 403) {
            message = `Upload of Files failed: You do not have permission to upload files for Mission ${selectedMission.name}`;
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

    // reset query key isUploading
    await queryClient.invalidateQueries({
        queryKey: ['isUploading'],
    });

    if (!temporaryCredentials) {
        return;
    }

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
        temporaryCredentials.map(async (accessResp, index) => {
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
            } as unknown as FileDto;
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

                    return await confirmUpload(accessResp.fileUUID, md5Hash);
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
        }),
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
    selectedMission: FlatMissionDto | null,
    driveUrl: Ref<string>,
) {
    // abort if no mission is selected
    if (selectedMission === null) return;

    const noti = Notify.create({
        group: false,
        message: 'Processing files...',
        color: 'positive',
        spinner: true,
        position: 'bottom',
        timeout: 0,
    });

    await createDrive(selectedMission.uuid, driveUrl.value)
        .then(() => {
            noti({
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

            noti({
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
    newFileUpload: Ref<FileDto>,
) {
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
        if (uploadId) {
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
