import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import environment from '@backend-common/environment';
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { StorageCredentials } from './types';

/** Upper bound of an upload credential's lifetime. */
export const MAX_UPLOAD_CREDENTIAL_SECONDS = 4 * 60 * 60;

/** Lower bound, so that a small file still survives a slow connection. */
export const MIN_UPLOAD_CREDENTIAL_SECONDS = 30 * 60;

/**
 * Throughput a client is assumed to manage at worst, used to give large
 * uploads the time they need without granting every upload the maximum.
 */
const ASSUMED_UPLOAD_BYTES_PER_SECOND = 1024 * 1024;

/**
 * @param seconds - requested lifetime
 * @returns the lifetime clamped into the allowed range
 */
function clampCredentialLifetime(seconds: number): number {
    return Math.min(
        MAX_UPLOAD_CREDENTIAL_SECONDS,
        Math.max(MIN_UPLOAD_CREDENTIAL_SECONDS, Math.ceil(seconds)),
    );
}

/**
 * Derives how long the credentials for an upload should live.
 *
 * Credentials outlive the upload they were issued for and cannot be revoked,
 * so the window is kept as small as the upload allows instead of handing every
 * upload the maximum.
 *
 * @param sizeBytes - size of the upload, when the client reported one
 * @returns lifetime in seconds
 */
export function uploadCredentialLifetimeSeconds(
    sizeBytes: number | undefined,
): number {
    if (sizeBytes === undefined || Number.isNaN(sizeBytes))
        return MAX_UPLOAD_CREDENTIAL_SECONDS;
    return clampCredentialLifetime(sizeBytes / ASSUMED_UPLOAD_BYTES_PER_SECOND);
}

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

    /**
     * Issues credentials for uploading a single object.
     *
     * SeaweedFS issues these as stateless JWTs, which means they cannot be
     * revoked once handed out - they stay usable for their full lifetime, also
     * after the upload has been confirmed. Two things keep that from mattering:
     * the policy names exactly one key in the ingest bucket, and the object is
     * promoted out of that bucket once it is confirmed.
     *
     * @param filename - object key the credentials may write
     * @param bucketName - bucket the credentials are scoped to
     * @param durationSeconds - lifetime of the credentials
     * @returns credentials for a single object
     */
    async generateTemporaryCredential(
        filename: string,
        bucketName: string,
        durationSeconds: number = MAX_UPLOAD_CREDENTIAL_SECONDS,
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
                    // No trailing wildcard: the credentials are for this one
                    // object, not for everything that happens to share its
                    // prefix.
                    Resource: [`arn:aws:s3:::${bucketName}/${filename}`],
                },
            ],
        };
        const sessionName = `UploadSession-${crypto.randomUUID()}`;

        // @ts-expect-error SeaweedFS supports omitting RoleArn for self-assumption
        const command = new AssumeRoleCommand({
            RoleSessionName: sessionName,
            Policy: JSON.stringify(policy),
            DurationSeconds: clampCredentialLifetime(durationSeconds),
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
