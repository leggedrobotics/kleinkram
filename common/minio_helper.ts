import env from './env';
import { FileType } from './enum';
import AssumeRoleProvider from 'minio/dist/main/AssumeRoleProvider.js';
import { BucketItem, Client } from 'minio';
import Credentials from 'minio/dist/main/Credentials';
import { Tags } from 'minio/dist/main/internal/type';

export const externalMinio: Client = new Client({
    endPoint: env.MINIO_ENDPOINT,
    useSSL: !env.DEV,
    port: env.DEV ? 9000 : 443,

    region: 'GUGUS GEWESEN',
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
});

export const internalMinio: Client = new Client({
    endPoint: 'minio',
    useSSL: false,
    port: 9000,

    region: 'GUGUS GEWESEN',
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
});

export async function getInfoFromMinio(fileType: FileType, location: string) {
    const bucketName = getBucketFromFileType(fileType);
    try {
        return await internalMinio.statObject(bucketName, location);
    } catch (e) {
        if (e.code === 'NotFound') {
            return null;
        }
        throw e;
    }
}

export async function addTagsToMinioObject(
    bucketName: string,
    objectName: string,
    tags: Tags,
) {
    return await internalMinio.setObjectTagging(bucketName, objectName, tags, {
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
    if (Object.values(FileType).indexOf(fileType) === -1) {
        throw new Error('Invalid file type');
    }

    return fileType === FileType.BAG
        ? env.MINIO_BAG_BUCKET_NAME
        : env.MINIO_MCAP_BUCKET_NAME;
}

/**
 * Delete a file from the minio bucket
 */
export async function deleteFileMinio(bucketName: string, location: string) {
    return internalMinio.removeObject(bucketName, location);
}

export function basePolicy(resource: string) {
    /* eslint-disable @typescript-eslint/naming-convention */
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
    /* eslint-enable @typescript-eslint/naming-convention */
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
        secretKey: env.MINIO_PASSWORD,
        accessKey: env.MINIO_USER,
        stsEndpoint: 'http://minio:9000',
        action: 'AssumeRole',
        policy: JSON.stringify(basePolicy(resource)),
        durationSeconds: 60 * 60 * 4, // 4 hours
    });

    return await provider.getCredentials();
}

export { BucketItem };
