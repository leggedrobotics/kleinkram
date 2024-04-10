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
  await minio.putObject(bucketName, fileName, buffer);
}