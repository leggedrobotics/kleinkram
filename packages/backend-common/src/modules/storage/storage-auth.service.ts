import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import environment from '@backend-common/environment';
import { Injectable } from '@nestjs/common';
import { StorageCredentials } from './types';

const ACTION_PUT_OBJECT = 's3:PutObject' as const;
const ACTION_ABORT_MULTIPART_UPLOAD = 's3:AbortMultipartUpload' as const;

@Injectable()
export class StorageAuthService {
    private readonly stsClient: STSClient;

    constructor() {
        this.stsClient = new STSClient({
            endpoint: 'http://seaweedfs:9000',
            region: 'us-east-1',
            credentials: {
                accessKeyId: environment.S3_ACCESS_KEY,
                secretAccessKey: environment.S3_SECRET_KEY,
            },
        });
    }

    async generateTemporaryCredential(
        filename: string,
        bucketName: string,
    ): Promise<StorageCredentials> {
        const resource = `arn:aws:s3:::${bucketName}/${filename}`;

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

        const command = new AssumeRoleCommand({
            RoleArn: 'arn:aws:iam::123456789012:role/S3Access',
            RoleSessionName: 'TemporaryUploadSession',
            Policy: JSON.stringify(policy),
            DurationSeconds: 60 * 60 * 4, // 4 Hours
        });

        const response = await this.stsClient.send(command);

        if (!response.Credentials) {
            throw new Error('Failed to generate temporary credentials via STS');
        }

        return {
            accessKey: response.Credentials.AccessKeyId ?? '',
            secretKey: response.Credentials.SecretAccessKey ?? '',
            sessionToken: response.Credentials.SessionToken ?? '',
        };
    }
}
