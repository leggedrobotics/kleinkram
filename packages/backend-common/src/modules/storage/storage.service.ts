import { StorageAuthService } from '@backend-common/modules/storage/storage-auth.service';
import { StorageMetricsService } from '@backend-common/modules/storage/storage-metrics.service';
import { Inject, Injectable } from '@nestjs/common';
import { BucketItemStat, Client, ItemBucketMetadata } from 'minio';
// @ts-ignore
import Credentials from 'minio/dist/main/Credentials';
// @ts-ignore
import { BucketItem, TaggingOpts, Tags } from 'minio/dist/main/internal/type';
import { Stream } from 'node:stream';

@Injectable()
export class StorageService {
    constructor(
        @Inject('MINIO_CLIENTS')
        private clients: { external: Client; internal: Client },
        private readonly metricsService: StorageMetricsService,
        private readonly authService: StorageAuthService,
    ) {}

    async getPresignedDownloadUrl(
        bucketName: string,
        objectName: string, // This is usually the file UUID
        expirySeconds: number,
        responseDisposition?: Record<string, string>,
    ): Promise<string> {
        return this.clients.external.presignedUrl(
            'GET',
            bucketName,
            objectName,
            expirySeconds,
            responseDisposition,
        );
    }

    async getInternalPresignedDownloadUrl(
        bucketName: string,
        objectName: string, // This is usually the file UUID
        expirySeconds: number,
        responseDisposition?: Record<string, string>,
    ): Promise<string> {
        return this.clients.internal.presignedUrl(
            'GET',
            bucketName,
            objectName,
            expirySeconds,
            responseDisposition,
        );
    }

    async downloadFile(
        bucketName: string,
        objectName: string,
        destinationPath: string,
    ): Promise<void> {
        await this.clients.internal.fGetObject(
            bucketName,
            objectName,
            destinationPath,
        );
    }

    async getFileStream(
        bucketName: string,
        objectName: string,
    ): Promise<Stream.Readable> {
        return this.clients.internal.getObject(bucketName, objectName);
    }

    async listFiles(bucketName: string): Promise<BucketItem[]> {
        const stream = this.clients.internal.listObjects(bucketName, '');
        const result: BucketItem[] = [];
        for await (const item of stream) {
            result.push(item);
        }
        return result;
    }

    async getFileInfo(
        bucketName: string,
        location: string,
    ): Promise<BucketItemStat | undefined> {
        try {
            return await this.clients.internal.statObject(bucketName, location);
        } catch (error: any) {
            if (error.code === 'NotFound') return;
            throw error;
        }
    }

    async uploadFile(
        bucketName: string,
        objectName: string,
        filePath: string,
        metaData: ItemBucketMetadata = {},
    ): Promise<void> {
        await this.clients.internal.fPutObject(
            bucketName,
            objectName,
            filePath,
            metaData,
        );
    }

    async deleteFile(bucketName: string, location: string): Promise<void> {
        await this.clients.internal.removeObject(bucketName, location);
    }

    async getTags(
        bucketName: string,
        objectName: string,
    ): Promise<Record<string, string>> {
        const tagList = await this.clients.internal.getObjectTagging(
            bucketName,
            objectName,
        );
        return this.normalizeTags(tagList);
    }

    async addTags(
        bucketName: string,
        objectName: string,
        tags: Tags,
    ): Promise<void> {
        await this.clients.internal.setObjectTagging(
            bucketName,
            objectName,
            tags,
            { versionId: 'null' },
        );
    }

    async removeTags(bucketName: string, objectName: string): Promise<void> {
        await this.clients.internal.removeObjectTagging(
            bucketName,
            objectName,
            {} as TaggingOpts,
        );
    }

    async getSystemMetrics(): Promise<any> {
        return this.metricsService.getSystemMetrics();
    }

    async generateTemporaryCredential(
        filename: string,
        bucketName: string,
    ): Promise<Credentials> {
        return this.authService.generateTemporaryCredential(
            filename,
            bucketName,
        );
    }

    private normalizeTags(tagList: any): Record<string, string> {
        if (Array.isArray(tagList)) {
            // eslint-disable-next-line unicorn/no-array-reduce
            return tagList.reduce((accumulator, tag) => {
                if (tag.Key && tag.Value) accumulator[tag.Key] = tag.Value;
                return accumulator;
            }, {});
        }
        if (typeof tagList === 'object') {
            return tagList as Record<string, string>;
        }
        return {};
    }
}
