import environment from '@backend-common/environment';
import { Injectable } from '@nestjs/common';
import { StorageCredentials } from './types';

@Injectable()
export class StorageAuthService {
    // eslint-disable-next-line @typescript-eslint/require-await
    async generateTemporaryCredential(
        // TODO: check if this is correct
        _filename: string, // Not used because we return global credentials for SeaweedFS
    ): Promise<StorageCredentials> {
        return {
            accessKey: environment.S3_ACCESS_KEY,
            secretKey: environment.S3_SECRET_KEY,
            sessionToken: '',
        };
    }
}
