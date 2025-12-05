import environment from '@backend-common/environment';
import { Injectable } from '@nestjs/common';
// @ts-ignore
import AssumeRoleProvider from 'minio/dist/main/AssumeRoleProvider.js';
// @ts-ignore
import Credentials from 'minio/dist/main/Credentials';

const ACTION_PUT_OBJECT = 's3:PutObject' as const;
const ACTION_ABORT_MULTIPART_UPLOAD = 's3:AbortMultipartUpload' as const;

@Injectable()
export class StorageAuthService {
    private readonly STS_ENDPOINT = 'http://minio:9000';

    async generateTemporaryCredential(
        filename: string,
        bucketName: string,
    ): Promise<Credentials> {
        const resource = `arn:aws:s3:::${bucketName}/${filename}`;

        // Policy extracted for clarity and potential reuse
        const policy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: [ACTION_PUT_OBJECT, ACTION_ABORT_MULTIPART_UPLOAD],
                    Resource: [resource],
                },
            ],
        };

        const provider = new AssumeRoleProvider({
            secretKey: environment.MINIO_PASSWORD,
            accessKey: environment.MINIO_USER,
            stsEndpoint: this.STS_ENDPOINT,
            action: 'AssumeRole',
            policy: JSON.stringify(policy),
            durationSeconds: 60 * 60 * 4, // 4 Hours
        });

        return provider.getCredentials();
    }
}
