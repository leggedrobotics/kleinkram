import environment from '@backend-common/environment';
import { Injectable } from '@nestjs/common';
// @ts-ignore
import Credentials from 'minio/dist/main/Credentials';

@Injectable()
export class StorageAuthService {
    // eslint-disable-next-line @typescript-eslint/require-await
    async generateTemporaryCredential(
        _filename: string,
        _bucketName: string,
    ): Promise<Credentials> {
        return {
            accessKey: environment.S3_ACCESS_KEY,
            secretKey: environment.S3_SECRET_KEY,
            sessionToken: '',
        } as unknown as Credentials;
    }
}
