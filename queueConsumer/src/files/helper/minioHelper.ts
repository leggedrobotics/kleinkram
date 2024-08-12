import { Client, CopyConditions } from 'minio';
import env from '@common/env';
import logger from '../../logger';
import { traceWrapper } from '../../tracing';
import fs from 'node:fs';
import { FileType } from '@common/enum';

const minio: Client = new Client({
    endPoint: 'minio',
    useSSL: false,
    port: 9000,

    region: 'GUGUS GEWESEN',
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
});

export async function uploadFile(
    bucketName: string,
    fileName: string,
    tmp_file_path: string,
) {
    return await traceWrapper(async (): Promise<boolean> => {
        logger.debug('Uploading file to Minio in parts...');
        await minio.fPutObject(bucketName, fileName, tmp_file_path);
        logger.debug('File uploaded to Minio in parts');
        return true;
    }, 'uploadFile')();
}

export async function downloadMinioFile(
    bucketName: string,
    fileName: string,
    tmp_file_name: string,
): Promise<boolean> {
    return await traceWrapper(async (): Promise<boolean> => {
        logger.debug('Downloading file from Minio...');
        const fileStream = await minio.getObject(bucketName, fileName);
        const writeStream = fs.createWriteStream(tmp_file_name);
        fileStream.pipe(writeStream);
        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => {
                logger.debug('File downloaded from Minio');
                resolve(true);
            });
            writeStream.on('error', (err) => {
                reject(err);
            });
        });
    }, 'downloadMinioFile')();
}

export async function deleteMinioFile(
    bucketName: string,
    fileName: string,
): Promise<void> {
    await traceWrapper(async (): Promise<void> => {
        await minio.removeObject(bucketName, fileName);
    }, 'deleteMinioFile')();
}

export async function copyMinioFile(
    sourceBucket: string,
    destBucket: string,
    fileName: string,
): Promise<void> {
    const sourceKey = `${sourceBucket}/${fileName}`;
    return new Promise((resolve, reject) => {
        minio.copyObject(
            env.MINIO_BAG_BUCKET_NAME,
            fileName,
            sourceKey,
            new CopyConditions(),
            async (err, res) => {
                if (err) reject(err);
                resolve();
            },
        );
    });
}

export async function getInfoFromMinio(fileType: FileType, location: string) {
    const bucketName =
        fileType === FileType.BAG
            ? env.MINIO_BAG_BUCKET_NAME
            : env.MINIO_MCAP_BUCKET_NAME;
    return minio.statObject(bucketName, location);
}
