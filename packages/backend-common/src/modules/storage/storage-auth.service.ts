import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import environment from '@backend-common/environment';
import { Injectable, Logger } from '@nestjs/common';
import { StorageCredentials } from './types';

@Injectable()
export class StorageAuthService {
    private readonly stsClient: STSClient;
    private readonly logger = new Logger(StorageAuthService.name);

    constructor() {
        let endpointUrl = environment.S3_ENDPOINT_INTERNAL;

        if (endpointUrl) {
            if (!endpointUrl.includes('://')) {
                endpointUrl = `http://${endpointUrl}`;
            }
            if (!endpointUrl.split('://')[1].includes(':')) {
                endpointUrl = `${endpointUrl}:9000`;
            }
        } else {
            endpointUrl = 'http://seaweedfs:9000';
        }

        this.stsClient = new STSClient({
            endpoint: endpointUrl,
            region: environment.S3_REGION ?? 'us-east-1',
            credentials: {
                accessKeyId: environment.S3_ACCESS_KEY,
                secretAccessKey: environment.S3_SECRET_KEY,
            },
            // Force AWS Signature V4 without payload signing to match SeaweedFS STS implementation expectations
            systemClockOffset: 0,
        });
    }

    async generateTemporaryCredential(
        filename: string,
        bucketName: string,
    ): Promise<StorageCredentials> {
        const policy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: [
                        's3:PutObject',
                        // Required for multipart uploads (files >8MB via boto3/aws sdk)
                        // SeaweedFS enforces each of these as distinct actions
                        's3:CreateMultipartUpload',
                        's3:UploadPart',
                        's3:CompleteMultipartUpload',
                        's3:AbortMultipartUpload',
                        's3:ListMultipartUploadParts',
                    ],
                    Resource: [`arn:aws:s3:::${bucketName}/${filename}*`],
                },
            ],
        };
        // @ts-expect-error SeaweedFS supports omitting RoleArn for self-assumption
        const command = new AssumeRoleCommand({
            RoleSessionName: 'TemporaryUploadSession',
            Policy: JSON.stringify(policy),
            DurationSeconds: 60 * 60 * 4, // 4 hours
        });

        try {
            const response = await this.stsClient.send(command);

            if (!response.Credentials) {
                throw new Error(
                    'STS AssumeRole response did not include credentials.',
                );
            }

            return {
                accessKey: response.Credentials.AccessKeyId ?? '',
                secretKey: response.Credentials.SecretAccessKey ?? '',
                sessionToken: response.Credentials.SessionToken ?? '',
            };
        } catch (error: unknown) {
            this.logger.error(
                'Failed to generate temporary STS credential',
                error instanceof Error ? error.message : error,
            );
            throw error;
        }
    }
}
