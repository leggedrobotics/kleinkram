import {
    DeleteObjectCommand,
    DeleteObjectTaggingCommand,
    GetObjectCommand,
    GetObjectTaggingCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    PutObjectTaggingCommand,
    _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StorageAuthService } from './storage-auth.service';
import { S3ClientContainer } from './storage-config.factory';
import { StorageMetricsService } from './storage-metrics.service';
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

    async getPresignedDownloadUrl(
        objectName: string,
        expirySeconds: number,
        responseDisposition?: Record<string, string>,
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: objectName,
            ResponseContentDisposition:
                responseDisposition?.['response-content-disposition'],
        });
        return getSignedUrl(this.clients.external, command, {
            expiresIn: expirySeconds,
        });
    }

    async getInternalPresignedDownloadUrl(
        objectName: string,
        expirySeconds: number,
        responseDisposition?: Record<string, string>,
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: objectName,
            ResponseContentDisposition:
                responseDisposition?.['response-content-disposition'],
        });
        return getSignedUrl(this.clients.internal, command, {
            expiresIn: expirySeconds,
        });
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
            if (
                error instanceof Error &&
                (error.name === 'NotFound' ||
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                    (error as any).$metadata?.httpStatusCode === 404)
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
        return {
            usedBytes: raw.minio_system_drive_used_bytes[0]?.value ?? 0,
            totalBytes: raw.minio_system_drive_total_bytes[0]?.value ?? 0,
            usedInodes: raw.minio_system_drive_used_inodes[0]?.value ?? 0,
            totalInodes: raw.minio_system_drive_total_inodes[0]?.value ?? 0,
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
        filename: string,
    ): Promise<StorageCredentials> {
        return this.authService.generateTemporaryCredential(filename);
    }
}
