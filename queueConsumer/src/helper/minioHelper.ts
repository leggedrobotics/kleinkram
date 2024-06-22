import { Client, CopyConditions } from 'minio';
import { Readable } from 'stream';
import logger from '../logger';
import { traceWrapper } from '../tracing';
import env from '@common/env';

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
    buffer: Buffer,
) {
    return await traceWrapper(async (): Promise<void> => {
        logger.debug('Uploading file to Minio in parts...');
        const chunksize = 1000000;
        const nrChunks = Math.ceil(buffer.length / chunksize);
        let partIndex = 0;

        const stream = new Readable({
            read() {
                if (partIndex < nrChunks) {
                    const start = partIndex * chunksize;
                    const end = start + chunksize;
                    const part = buffer.slice(start, end);
                    this.push(part);
                    partIndex += 1;
                } else {
                    this.push(null); // No more data to push, signal EOF
                }
            },
        });

        await minio.putObject(bucketName, fileName, stream);
        logger.debug('File uploaded to Minio in parts');
    }, 'uploadFile')();
}

export async function downloadMinioFile(bucketName: string, fileName: string) {
    return await traceWrapper(
        async (): Promise<Buffer> =>
            new Promise(async (resolve, reject) => {
                const stream = await minio.getObject(bucketName, fileName);
                const chunks: Uint8Array[] = [];

                stream.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                stream.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });

                stream.on('error', (err) => {
                    reject(err);
                });
            }),
        'downloadMinioFile',
    )();
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
