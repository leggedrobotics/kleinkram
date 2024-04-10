import { Client } from 'minio';
import env from '../env';

const minio: Client = new Client({
  endPoint: 'minio',
  useSSL: false,
  port: 9000,

  region: 'GUGUS GEWESEN',
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});


export async function uploadFile(bucketName: string, fileName: string, buffer: Buffer): Promise<void> {
  console.log('Uploading file to Minio...')
  await minio.putObject(bucketName, fileName, buffer);
  console.log('File uploaded to Minio');
}

export async function downloadMinioFile(bucketName: string, fileName: string): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
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
  });
}

export async function deleteMinioFile(bucketName: string, fileName: string): Promise<void> {
  await minio.removeObject(bucketName, fileName);
}