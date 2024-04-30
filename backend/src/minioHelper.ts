import { Client } from 'minio';
import env from './env';

export const minio: Client = new Client({
  endPoint: env.MINIO_ENDPOINT, // env.MINIO_ENDPOINT,
  useSSL: false, // !env.DEV,
  port: env.DEV ? 9000 : 9000,

  region: 'GUGUS GEWESEN',
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

export async function uploadToMinio(response: any, originalname: string) {
  const filename = originalname.replace('.bag', '.mcap');
  await this.minio.putObject(
    env.MINIO_TEMP_BAG_BUCKET_NAME,
    filename,
    response.data,
    {
      'Content-Type': 'application/octet-stream',
    },
  );
}
