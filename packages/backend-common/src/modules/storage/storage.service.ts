import {
    DeleteObjectCommand,
    DeleteObjectTaggingCommand,
    GetBucketLifecycleConfigurationCommand,
    GetObjectCommand,
    GetObjectTaggingCommand,
    HeadObjectCommand,
    LifecycleRule,
    ListObjectsV2Command,
    NotFound,
    PutBucketCorsCommand,
    PutBucketLifecycleConfigurationCommand,
    PutObjectTaggingCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import environment from '@backend-common/environment';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Readable } from 'node:stream';
import { S3StorageBucket } from './s3-storage-bucket';
import { StorageAuthService } from './storage-auth.service';
import { S3ClientContainer } from './storage-config.factory';
import { StorageMetricsService } from './storage-metrics.service';
import {
    StorageCredentials,
    StorageItem,
    StorageItemStat,
    StorageSystemMetrics,
} from './types';

@Injectable()
export class StorageService implements OnModuleInit {
    constructor(
        @Inject('S3_CLIENTS')
        private readonly clients: S3ClientContainer,
        private readonly metricsService: StorageMetricsService,
        private readonly authService: StorageAuthService,
    ) {}

    async onModuleInit(): Promise<void> {
        const buckets = [
            environment.S3_DATA_BUCKET_NAME,
            environment.S3_ARTIFACTS_BUCKET_NAME,
            environment.S3_DB_BUCKET_NAME,
        ];

        for (const bucketName of buckets) {
            try {
                const command = new PutBucketCorsCommand({
                    Bucket: bucketName,
                    CORSConfiguration: {
                        CORSRules: [
                            {
                                AllowedHeaders: ['*'],
                                AllowedMethods: [
                                    'GET',
                                    'PUT',
                                    'POST',
                                    'DELETE',
                                    'HEAD',
                                ],
                                AllowedOrigins: ['*'],
                                ExposeHeaders: [
                                    'Content-Range',
                                    'Content-Length',
                                    'ETag',
                                    'Accept-Ranges',
                                    'Content-Disposition',
                                ],
                                MaxAgeSeconds: 3000,
                            },
                        ],
                    },
                });
                await this.clients.internal.send(command);
                Logger.debug(
                    `Configured CORS for S3 bucket ${bucketName}`,
                    'StorageService',
                );
            } catch (error) {
                Logger.warn(
                    `Failed to configure CORS for S3 bucket ${bucketName}: ${String(error)}`,
                    'StorageService',
                );
            }

            try {
                await this.applyMultipartUploadLifecycleRule(bucketName);
            } catch (error) {
                Logger.warn(
                    `Failed to configure Lifecycle for S3 bucket ${bucketName}: ${String(error)}`,
                    'StorageService',
                );
            }
        }
    }

    /**
     * Applies a lifecycle rule to abort incomplete multipart uploads after 1 day.
     * This method fetches the existing lifecycle rules for the bucket and appends
     * the new rule to them, preserving any existing rules (e.g., transition or
     * expiration rules) that may have been configured externally via IaC.
     *
     * @param bucketName The name of the S3 bucket to apply the rule to.
     */
    private async applyMultipartUploadLifecycleRule(
        bucketName: string,
    ): Promise<void> {
        let existingRules: LifecycleRule[] = [];
        try {
            const getCommand = new GetBucketLifecycleConfigurationCommand({
                Bucket: bucketName,
            });
            const response = await this.clients.internal.send(getCommand);
            existingRules = response.Rules ?? [];
        } catch (error: unknown) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'name' in error &&
                (error as Error).name === 'NoSuchLifecycleConfiguration'
            ) {
                // No lifecycle configuration exists; we can proceed to create one
            } else {
                throw error;
            }
        }

        const ruleId = 'AbortIncompleteMultipartUpload';
        const ruleExists = existingRules.some((r) => r.ID === ruleId);

        if (!ruleExists) {
            existingRules.push({
                ID: ruleId,
                Status: 'Enabled',
                Filter: {}, // Empty filter applies to all objects
                AbortIncompleteMultipartUpload: {
                    DaysAfterInitiation: 1,
                },
            });

            const lifecycleCommand = new PutBucketLifecycleConfigurationCommand(
                {
                    Bucket: bucketName,
                    LifecycleConfiguration: {
                        Rules: existingRules,
                    },
                },
            );
            await this.clients.internal.send(lifecycleCommand);
            Logger.debug(
                `Configured Lifecycle for S3 bucket ${bucketName}`,
                'StorageService',
            );
        }
    }

    private async generatePresignedUrl(
        bucketName: string,
        objectName: string,
        expirySeconds: number,
        isInternal: boolean,
        responseDisposition?: Record<string, string>,
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: objectName,
            ResponseContentDisposition:
                responseDisposition?.['response-content-disposition'],
        });
        const client = isInternal
            ? this.clients.internal
            : this.clients.external;
        return getSignedUrl(client, command, {
            expiresIn: expirySeconds,
        });
    }

    async getPresignedDownloadUrl(
        bucketName: string,
        objectName: string,
        expirySeconds: number,
        responseDisposition?: Record<string, string>,
    ): Promise<string> {
        return this.generatePresignedUrl(
            bucketName,
            objectName,
            expirySeconds,
            false,
            responseDisposition,
        );
    }

    async getInternalPresignedDownloadUrl(
        bucketName: string,
        objectName: string,
        expirySeconds: number,
        responseDisposition?: Record<string, string>,
    ): Promise<string> {
        return this.generatePresignedUrl(
            bucketName,
            objectName,
            expirySeconds,
            true,
            responseDisposition,
        );
    }

    async downloadFile(
        bucketName: string,
        objectName: string,
        destinationPath: string,
    ): Promise<void> {
        // We reuse S3StorageBucket logic here but create a transient instance
        const bucket = new S3StorageBucket(
            bucketName,
            this.clients,
            this.authService,
        );
        return bucket.downloadFile(objectName, destinationPath);
    }

    async getFileStream(
        bucketName: string,
        objectName: string,
    ): Promise<Readable> {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: objectName,
        });
        const response = await this.clients.internal.send(command);
        if (response.Body instanceof Readable) {
            return response.Body;
        }
        throw new TypeError('S3 body is not a readable stream');
    }

    async listFiles(bucketName: string): Promise<StorageItem[]> {
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
        });
        const response = await this.clients.internal.send(command);
        return (
            response.Contents?.map((item) => ({
                name: item.Key ?? '',
                lastModified: item.LastModified ?? new Date(),
                etag: item.ETag ?? '',
                size: item.Size ?? 0,
            })) ?? []
        );
    }

    async getFileInfo(
        bucketName: string,
        objectName: string,
    ): Promise<StorageItemStat | undefined> {
        const command = new HeadObjectCommand({
            Bucket: bucketName,
            Key: objectName,
        });
        try {
            const response = await this.clients.internal.send(command);
            return {
                size: response.ContentLength ?? 0,
                etag: response.ETag ?? '',
                lastModified: response.LastModified ?? new Date(),
                metaData: response.Metadata ?? {},
            };
        } catch (error: unknown) {
            if (error instanceof NotFound) {
                return undefined;
            }
            throw error;
        }
    }

    async uploadFile(
        bucketName: string,
        objectName: string,
        filePath: string,
        metaData?: Record<string, string>,
    ): Promise<void> {
        const bucket = new S3StorageBucket(
            bucketName,
            this.clients,
            this.authService,
        );
        return bucket.uploadFile(objectName, filePath, metaData);
    }

    async deleteFile(bucketName: string, objectName: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: objectName,
        });
        await this.clients.internal.send(command);
    }

    async getTags(
        bucketName: string,
        objectName: string,
    ): Promise<Record<string, string>> {
        const command = new GetObjectTaggingCommand({
            Bucket: bucketName,
            Key: objectName,
        });
        const response = await this.clients.internal.send(command);
        const tags: Record<string, string> = {};
        if (response.TagSet) {
            for (const tag of response.TagSet) {
                if (tag.Key && tag.Value) {
                    tags[tag.Key] = tag.Value;
                }
            }
        }
        return tags;
    }

    async addTags(
        bucketName: string,
        objectName: string,
        tags: Record<string, string>,
    ): Promise<void> {
        const command = new PutObjectTaggingCommand({
            Bucket: bucketName,
            Key: objectName,
            Tagging: {
                TagSet: Object.entries(tags).map(([key, value]) => ({
                    Key: key,
                    Value: value,
                })),
            },
        });
        await this.clients.internal.send(command);
    }

    async removeTags(bucketName: string, objectName: string): Promise<void> {
        const command = new DeleteObjectTaggingCommand({
            Bucket: bucketName,
            Key: objectName,
        });
        await this.clients.internal.send(command);
    }

    async getSystemMetrics(): Promise<StorageSystemMetrics> {
        const bucket = new S3StorageBucket(
            'unused',
            this.clients,
            this.authService,
            this.metricsService,
        );
        return bucket.getSystemMetrics();
    }

    async generateTemporaryCredential(
        bucketName: string,
        filename: string,
    ): Promise<StorageCredentials> {
        return this.authService.generateTemporaryCredential(
            filename,
            bucketName,
        );
    }
}
