import { BucketItem, Client } from 'minio';
import env from '@common/env';
import { FileType } from '@common/enum';
const aws4 = require('aws4');
import * as querystring from 'querystring';
import axios from 'axios';
import { request } from 'http';

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
                Action: 's3:ListBucket',
                Resource: 'arn:aws:s3:::bags',
            },
        ],
    };
}

export async function generateTemporaryCredentials(filenames: string[]) {
    // const resources = filenames.map(
    //     (filename) => `arn:aws:s3:::${env.MINIO_BAG_BUCKET_NAME}/${filename}`,
    // );
    // const policy = basePolicy(resources);
    const host = 'minio';
    //
    const baseUrl = `http://${host}:9000/`;
    // const params = {
    //     Action: 'AssumeRole',
    //     DurationSeconds: '3600',
    //     Version: '2011-06-15',
    //     Policy: JSON.stringify(policy),
    // };
    //
    // // Generate the query string
    // const queryString = querystring.stringify(params);
    const queryString =
        '?Action=AssumeRole&DurationSeconds=3600&Version=2011-06-15&Policy={"Version":"2012-10-17","Statement":[{"Sid":"Stmt1","Effect":"Allow","Action":"s3:*","Resource":"arn:aws:s3:::*"}]}';
    // Prepare the request options
    const requestOptions = {
        host,
        path: `${queryString}`,
        service: 'sts',
        region: 'us-east-1',
        method: 'GET',
    };

    // Sign the request using aws4
    const res = aws4.sign(requestOptions, {
        accessKeyId: env.MINIO_ACCESS_KEY,
        secretAccessKey: env.MINIO_SECRET_KEY,
    });

    // Construct the final URL
    const finalUrl = `${baseUrl}${requestOptions.path}&${querystring.stringify(res.headers)}`;
    console.log('finalUrl', finalUrl);
    try {
        const res2 = await axios.get(finalUrl);
        console.log('res2', res2);
    } catch (e) {
        console.log('error', e);
    }
    return finalUrl;
}
