import { BucketItem, Client } from 'minio';
import env from './env';

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
    useSSL: !env.DEV,
    port: env.DEV ? 9000 : 443,

    region: 'GUGUS GEWESEN',
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
});

export async function uploadToMinio(response: any, originalname: string) {
    const filename = originalname.replace('.bag', '.mcap');
    await internalMinio.putObject(
        env.MINIO_TEMP_BAG_BUCKET_NAME,
        filename,
        response.data,
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
async function copyObject(bucketName, srcName, destName) {
    return new Promise((resolve, reject) => {
        internalMinio.copyObject(
            bucketName,
            destName,
            `/${bucketName}/${srcName}`,
            null,
            (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            },
        );
    });
}

// Function to remove an object from the bucket
async function removeObject(bucketName, objectName): Promise<void> {
    return new Promise((resolve, reject) => {
        internalMinio.removeObject(bucketName, objectName, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

//* srcPath: Project1/Run1
//* destPath: Project2/Run1
export async function moveRunFilesInMinio(srcPath, destProject) {
    try {
        const objects = await listObjects(
            process.env.MINIO_BAG_BUCKET_NAME,
            srcPath,
        );
        const run = srcPath.split('/')[1];
        await Promise.all(
            objects.map(async (obj) => {
                const filename = obj.name.split('/').slice(2).join('/');
                console.log('destFile', filename);
                const destName = `${destProject}/${run}/${filename}`;
                await copyObject(
                    process.env.MINIO_BAG_BUCKET_NAME,
                    obj.name,
                    destName,
                );
                await removeObject(process.env.MINIO_BAG_BUCKET_NAME, obj.name);
            }),
        );

        console.log('Files moved successfully');
    } catch (err) {
        console.error('Error moving files:', err);
    }
}
