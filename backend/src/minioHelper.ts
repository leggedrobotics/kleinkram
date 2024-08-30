import { BucketItem, Client } from 'minio';
import env from '@common/env';
import { FileType } from '@common/enum';
import AssumeRoleProvider from 'minio/dist/main/AssumeRoleProvider.js';

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

export async function uploadToMinio(response: any, originalname: string) {
    const filename = originalname.replace('.bag', '.mcap');
    await internalMinio.putObject(
        env.MINIO_BAG_BUCKET_NAME,
        filename,
        response.data,
        undefined,
        {
            'Content-Type': 'application/octet-stream',
        },
    );
}

// Function to list objects in a bucket
async function listObjects(bucketName, prefix): Promise<BucketItem[]> {
    return new Promise((resolve, reject) => {
        const objects: BucketItem[] = [];
        const stream = internalMinio.listObjectsV2(bucketName, prefix, true);
        stream.on('data', (obj) => objects.push(obj));
        stream.on('end', () => resolve(objects));
        stream.on('error', (err) => reject(err));
    });
}

// Function to copy an object within the bucket
/**
 * Copy an object within the bucket
 * @param bucketName - Name of the bucket
 * @param srcName - Name of the source object within the bucket
 * @param destName - Name of the destination object within the bucket name
 */
async function copyObject(bucketName, srcName, destName) {
    return internalMinio.copyObject(
        bucketName,
        destName,
        `/${bucketName}/${srcName}`,
    );
}

// Function to remove an object from the bucket
async function removeObject(
    bucketName: string,
    objectName: string,
): Promise<void> {
    return internalMinio.removeObject(bucketName, objectName);
}

export async function moveFile(
    srcPath: string,
    destPath: string,
    bucketName: string,
) {
    try {
        await copyObject(bucketName, srcPath, destPath);
        await removeObject(bucketName, srcPath);
    } catch (err) {
        console.error('Error moving file:', err);
    }
}

//* srcPath: Project1/Run1
//* destPath: Project2
export async function moveMissionFilesInMinio(
    srcPath: string,
    destProject: string,
    bucketName: string,
) {
    try {
        const objects = await listObjects(bucketName, srcPath);
        const mission = srcPath.split('/')[1];
        await Promise.all(
            objects.map(async (obj) => {
                const filename = obj.name.split('/').slice(2).join('/');
                const destName = `${destProject}/${mission}/${filename}`;
                await moveFile(obj.name, destName, bucketName);
            }),
        );
    } catch (err) {
        console.error('Error moving files:', err);
    }
}

export async function getInfoFromMinio(fileType: FileType, location: string) {
    const bucketName =
        fileType === FileType.BAG
            ? env.MINIO_BAG_BUCKET_NAME
            : env.MINIO_MCAP_BUCKET_NAME;
    return internalMinio.statObject(bucketName, location);
}

export async function deleteFileMinio(bucketName: string, location: string) {
    return internalMinio.removeObject(bucketName, location);
}

export function basePolicy(resources: string[]) {
    return {
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Action: ['s3:PutObject', 's3:AbortMultipartUpload'],
                Resource: resources,
            },
        ],
    };
}

export async function generateTemporaryCredentials(filenames: string[]) {
    const resources = filenames.map((filename) => {
        if (filename.endsWith('.bag')) {
            return `arn:aws:s3:::${env.MINIO_BAG_BUCKET_NAME}/${filename}`;
        }
        return `arn:aws:s3:::${env.MINIO_MCAP_BUCKET_NAME}/${filename}`;
    });

    const provider = new AssumeRoleProvider({
        secretKey: env.MINIO_PASSWORD,
        accessKey: env.MINIO_USER,
        stsEndpoint: 'http://minio:9000',
        action: 'AssumeRole',
        policy: JSON.stringify(basePolicy(resources)),
        durationSeconds: 60 * 60 * 4, // 4 hours
    });

    return await provider.getCredentials();
}
