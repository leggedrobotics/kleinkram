import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CreateMultipartUploadCommand,
    S3Client,
    UploadPartCommand,
} from '@aws-sdk/client-s3';
import logger from '../../src/logger';

export async function uploadFileMultipart(
    file: Buffer,
    bucket: string,
    key: string,
    minioClient: S3Client,
) {
    let uploadId: string | undefined;
    try {
        // Step 1: Initiate Multipart Upload
        const createMultipartUploadCommand = new CreateMultipartUploadCommand({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Bucket: bucket,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Key: key,
        });
        const { UploadId: _uploadID } = await minioClient.send(
            createMultipartUploadCommand,
        );
        uploadId = _uploadID;

        // Step 2: Upload Parts
        const partSize = 50 * 1024 * 1024; // 5 MB per part (adjust as needed)
        const parts = [];
        for (
            let partNumber = 1, start = 0;
            start < file.length;
            partNumber++, start += partSize
        ) {
            const end = Math.min(start + partSize, file.length);
            const partBlob = file.slice(start, end);
            const uploadPartCommand = new UploadPartCommand({
                // eslint-disable-next-line @typescript-eslint/naming-convention
                Bucket: bucket,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                Key: key,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                PartNumber: partNumber,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                UploadId: uploadId,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                Body: partBlob,
            });
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const { ETag } = await minioClient.send(uploadPartCommand);
            // eslint-disable-next-line @typescript-eslint/naming-convention
            parts.push({ PartNumber: partNumber, ETag });
        }

        // Step 3: Complete Multipart Upload
        const completeMultipartUploadCommand =
            new CompleteMultipartUploadCommand({
                // eslint-disable-next-line @typescript-eslint/naming-convention
                Bucket: bucket,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                Key: key,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                UploadId: uploadId,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                MultipartUpload: { Parts: parts },
            });
        return await minioClient.send(completeMultipartUploadCommand);
    } catch (error) {
        logger.error('Multipart upload failed:', error);

        // Step 4 (Optional): Abort Multipart Upload
        if (uploadId) {
            const abortMultipartUploadCommand = new AbortMultipartUploadCommand(
                {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    Bucket: bucket,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    Key: key,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    UploadId: uploadId,
                },
            );
            await minioClient.send(abortMultipartUploadCommand);
            logger.debug('Multipart upload aborted.');
        }

        throw error;
    }
}
