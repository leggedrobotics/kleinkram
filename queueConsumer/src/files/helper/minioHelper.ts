import { Client } from 'minio';
import env from '@common/env';
import logger from '../../logger';
import { traceWrapper } from '../../tracing';
import fs from 'node:fs';
import * as crypto from 'crypto';

const minio: Client = new Client({
    endPoint: 'minio',
    useSSL: false,
    port: 9000,

    region: 'GUGUS GEWESEN',
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
});

/**
 * Uploads a file to Minio in parts.
 *
 * @param bucketName the name of the bucket to upload the file to
 * @param identifier the identifier of the file
 * @param fileName the name of the file (added as metadata)
 * @param tmp_file_path the path to the file to upload
 */
export async function uploadLocalFile(
    bucketName: string,
    identifier: string,
    fileName: string,
    tmp_file_path: string,
) {
    return await traceWrapper(async (): Promise<boolean> => {
        logger.debug('Uploading file to Minio in parts...');
        await minio.fPutObject(bucketName, identifier, tmp_file_path, {
            fileName: fileName,
            'Content-Type': 'application/octet-stream',
        });
        logger.debug('File uploaded to Minio in parts');
        return true;
    }, 'uploadFile')();
}

export async function downloadMinioFile(
    bucketName: string,
    fileName: string,
    tmp_file_name: string,
): Promise<string> {
    return await traceWrapper(async (): Promise<string> => {
        const hash = crypto.createHash('md5');
        logger.debug('Downloading file from Minio...');
        const fileStream = await minio.getObject(bucketName, fileName);
        const writeStream = fs.createWriteStream(tmp_file_name);

        fileStream.on('data', (chunk) => {
            hash.update(chunk);
        });
        fileStream.pipe(writeStream);
        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => {
                const fileHash = hash.digest('base64');
                logger.debug('File downloaded from Minio');
                resolve(fileHash);
            });
            writeStream.on('error', (err) => {
                reject(err);
            });
        });
    }, 'downloadMinioFile')();
}
