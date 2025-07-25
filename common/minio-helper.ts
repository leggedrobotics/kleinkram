import { Client } from 'minio';
import AssumeRoleProvider from 'minio/dist/main/AssumeRoleProvider.js';
import Credentials from 'minio/dist/main/Credentials';
import { Tags } from 'minio/dist/main/internal/type';
import environment from './environment';
import { FileType } from './frontend_shared/enum';

export const externalMinio: Client = new Client({
    endPoint: environment.MINIO_ENDPOINT,
    useSSL: !environment.DEV,
    port: environment.DEV ? 9000 : 443,

    region: 'GUGUS GEWESEN',
    accessKey: environment.MINIO_ACCESS_KEY,
    secretKey: environment.MINIO_SECRET_KEY,
});

export const internalMinio: Client = new Client({
    endPoint: 'minio',
    useSSL: false,
    port: 9000,

    region: 'GUGUS GEWESEN',
    accessKey: environment.MINIO_ACCESS_KEY,
    secretKey: environment.MINIO_SECRET_KEY,
});

export async function getInfoFromMinio(fileType: FileType, location: string) {
    const bucketName = getBucketFromFileType(fileType);
    try {
        return await internalMinio.statObject(bucketName, location);
    } catch (error: any) {
        if (error.code === 'NotFound') {
            return null;
        }
        throw error;
    }
}

export async function addTagsToMinioObject(
    bucketName: string,
    objectName: string,
    tags: Tags,
) {
    await internalMinio.setObjectTagging(bucketName, objectName, tags, {
        versionId: 'null',
    });
}

/**
 * Get the bucket name from the file type
 *
 * @param fileType - The file type to get the bucket name for
 *
 */
export function getBucketFromFileType(fileType: FileType): string {
    if (!Object.values(FileType).includes(fileType)) {
        throw new Error('Invalid file type');
    }

    return fileType === FileType.BAG
        ? environment.MINIO_BAG_BUCKET_NAME
        : environment.MINIO_MCAP_BUCKET_NAME;
}

/**
 * Delete a file from the minio bucket
 */
export async function deleteFileMinio(bucketName: string, location: string) {
    return internalMinio.removeObject(bucketName, location);
}

export function basePolicy(resource: string) {
    return {
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Action: ['s3:PutObject', 's3:AbortMultipartUpload'],
                Resource: [resource],
            },
        ],
    };
}

/**
 * Generate temporary credential for the user to upload a file to the minio bucket.
 * @param filename
 * @param bucketName
 */
export async function generateTemporaryCredential(
    filename: string,
    bucketName: string,
): Promise<Credentials> {
    const resource = `arn:aws:s3:::${bucketName}/${filename}`;

    const provider = new AssumeRoleProvider({
        secretKey: environment.MINIO_PASSWORD,
        accessKey: environment.MINIO_USER,
        stsEndpoint: 'http://minio:9000',
        action: 'AssumeRole',
        policy: JSON.stringify(basePolicy(resource)),
        durationSeconds: 60 * 60 * 4, // 4 hours
    });

    return await provider.getCredentials();
}

export { BucketItem } from 'minio';
