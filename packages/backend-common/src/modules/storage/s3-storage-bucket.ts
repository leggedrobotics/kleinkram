import {
    DeleteObjectCommand,
    DeleteObjectTaggingCommand,
    GetObjectCommand,
    GetObjectTaggingCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    NotFound,
    PutObjectCommand,
    PutObjectTaggingCommand,
    _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '@nestjs/common';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StorageAuthService } from './storage-auth.service';
import { S3ClientContainer } from './storage-config.factory';
import { MetricPoint, StorageMetricsService } from './storage-metrics.service';
import {
    IStorageBucket,
    StorageCredentials,
    StorageItem,
    StorageItemStat,
    StorageSystemMetrics,
} from './types';

export class S3StorageBucket implements IStorageBucket {
    constructor(
        private readonly bucketName: string,
        private readonly clients: S3ClientContainer,
        private readonly authService: StorageAuthService,
        private readonly metricsService?: StorageMetricsService,
    ) {}

    private async generatePresignedUrl(
        objectName: string,
        expirySeconds: number,
        isInternal: boolean,
        responseDisposition?: Record<string, string>,
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
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
        objectName: string,
        expirySeconds: number,
        responseDisposition?: Record<string, string>,
    ): Promise<string> {
        return this.generatePresignedUrl(
            objectName,
            expirySeconds,
            false,
            responseDisposition,
        );
    }

    async getInternalPresignedDownloadUrl(
        objectName: string,
        expirySeconds: number,
        responseDisposition?: Record<string, string>,
    ): Promise<string> {
        return this.generatePresignedUrl(
            objectName,
            expirySeconds,
            true,
            responseDisposition,
        );
    }

    async downloadFile(
        objectName: string,
        destinationPath: string,
    ): Promise<void> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: objectName,
        });
        const response = await this.clients.internal.send(command);
        if (response.Body instanceof Readable) {
            await pipeline(response.Body, createWriteStream(destinationPath));
        } else {
            throw new TypeError('S3 body is not a readable stream');
        }
    }

    async getFileStream(objectName: string): Promise<Readable> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: objectName,
        });
        const response = await this.clients.internal.send(command);
        if (response.Body instanceof Readable) {
            return response.Body;
        }
        throw new TypeError('S3 body is not a readable stream');
    }

    async listFiles(): Promise<StorageItem[]> {
        const command = new ListObjectsV2Command({
            Bucket: this.bucketName,
        });
        const response = await this.clients.internal.send(command);
        return (
            response.Contents?.map((item: _Object) => ({
                name: item.Key ?? '',
                lastModified: item.LastModified ?? new Date(),
                etag: item.ETag ?? '',
                size: item.Size ?? 0,
            })) ?? []
        );
    }

    async getFileInfo(
        objectName: string,
    ): Promise<StorageItemStat | undefined> {
        const command = new HeadObjectCommand({
            Bucket: this.bucketName,
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
            let statusCode: number | undefined;
            let errorCode: string | undefined;

            if (typeof error === 'object' && error !== null) {
                const errorObject = error as Record<string, unknown>;
                if (typeof errorObject.name === 'string') {
                    errorCode = errorObject.name;
                } else if (typeof errorObject.Code === 'string') {
                    errorCode = errorObject.Code;
                }

                if (
                    typeof errorObject.$metadata === 'object' &&
                    errorObject.$metadata !== null
                ) {
                    const metadata = errorObject.$metadata as Record<
                        string,
                        unknown
                    >;
                    if (typeof metadata.httpStatusCode === 'number') {
                        statusCode = metadata.httpStatusCode;
                    }
                }
            }

            if (
                error instanceof NotFound ||
                statusCode === 404 ||
                errorCode === 'NotFound' ||
                errorCode === 'NoSuchKey'
            ) {
                return undefined;
            }
            throw error;
        }
    }

    async uploadFile(
        objectName: string,
        filePath: string,
        metaData?: Record<string, string>,
    ): Promise<void> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: objectName,
            Body: createReadStream(filePath),
            Metadata: metaData,
        });
        await this.clients.internal.send(command);
    }

    async deleteFile(objectName: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: objectName,
        });
        await this.clients.internal.send(command);
    }

    async getSystemMetrics(): Promise<StorageSystemMetrics> {
        if (!this.metricsService) {
            return {
                usedBytes: 0,
                totalBytes: 0,
                usedInodes: 0,
                totalInodes: 0,
            };
        }
        const raw = await this.metricsService.getSystemMetrics();

        const totalRaw = raw.seaweedfs_master_disk_total_bytes as
            | MetricPoint[]
            | undefined;
        const volRecord = raw.SeaweedFS_volumeServer_resource as
            | MetricPoint[]
            | undefined;

        const totalValue =
            totalRaw?.[0]?.value ??
            volRecord?.find((m) => m.labels.type === 'all')?.value;
        const total = totalValue ?? 0;

        const freeRaw = raw.seaweedfs_master_disk_free_bytes as
            | MetricPoint[]
            | undefined;
        const freeValue =
            freeRaw?.[0]?.value ??
            volRecord?.find((m) => m.labels.type === 'free')?.value;
        const free = freeValue ?? 0;

        if (totalValue === undefined && freeValue === undefined) {
            Logger.warn(
                'SeaweedFS storage metrics (seaweedfs_master_disk_total_bytes or SeaweedFS_volumeServer_resource) were not found in the parsed response. Storage capacity views may read zero.',
                'S3StorageBucket:getSystemMetrics',
            );
        }

        return {
            usedBytes: total - free,
            totalBytes: total,
            usedInodes: 0,
            totalInodes: 0,
        };
    }

    async getTags(objectName: string): Promise<Record<string, string>> {
        const command = new GetObjectTaggingCommand({
            Bucket: this.bucketName,
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
        objectName: string,
        tags: Record<string, string>,
    ): Promise<void> {
        const command = new PutObjectTaggingCommand({
            Bucket: this.bucketName,
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

    async removeTags(objectName: string): Promise<void> {
        const command = new DeleteObjectTaggingCommand({
            Bucket: this.bucketName,
            Key: objectName,
        });
        await this.clients.internal.send(command);
    }

    async generateTemporaryCredential(
        filename: string, // This is usually the UUID/object name used for the ARN
    ): Promise<StorageCredentials> {
        return this.authService.generateTemporaryCredential(
            filename,
            this.bucketName,
        );
    }
}
