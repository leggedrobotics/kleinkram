import { FileEventEntity } from '@kleinkram/backend-common/entities/file/file-event.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { UniversalHttpReader } from '@kleinkram/shared';
import { McapIndexedReader } from '@mcap/core';
import { IReadable } from '@mcap/core/dist/cjs/src/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fsPromises from 'node:fs/promises';
import { Repository } from 'typeorm';
import { AbstractMetadataService } from './abstract-metadata.service';
import { ExtractedTopicInfo } from './file-handler.interface';

class LocalFileReader implements IReadable {
    constructor(
        private handle: fsPromises.FileHandle,
        private _size: number,
    ) {}
    async size(): Promise<bigint> {
        return new Promise((resolve) => {
            resolve(BigInt(this._size));
        });
    }
    async read(offset: bigint, length: bigint): Promise<Uint8Array> {
        const buffer = new Uint8Array(Number(length));
        await this.handle.read(buffer, 0, Number(length), Number(offset));
        return buffer;
    }
}

@Injectable()
export class McapMetadataService extends AbstractMetadataService {
    constructor(
        @InjectRepository(TopicEntity) topicRepo: Repository<TopicEntity>,
        @InjectRepository(FileEntity) fileRepo: Repository<FileEntity>,
        @InjectRepository(FileEventEntity)
        fileEventRepo: Repository<FileEventEntity>,
    ) {
        super(topicRepo, fileRepo, fileEventRepo);
    }

    async extractFromUrl(
        presignedUrl: string,
        targetEntity: FileEntity,
        headers: Record<string, string> = {},
        actor?: UserEntity,
    ): Promise<void> {
        const startTime = Date.now();
        const fileReader = new UniversalHttpReader(presignedUrl, headers);
        await fileReader.init();
        await this.processReader(fileReader, targetEntity, startTime, actor);
    }

    async extractFromLocalFile(
        filePath: string,
        targetEntity: FileEntity,
        actor?: UserEntity,
    ): Promise<void> {
        const startTime = Date.now();
        const handle = await fsPromises.open(filePath, 'r');
        try {
            const stat = await handle.stat();
            const fileReader = new LocalFileReader(handle, stat.size);
            await this.processReader(
                fileReader,
                targetEntity,
                startTime,
                actor,
            );
        } finally {
            await handle.close();
        }
    }

    private async processReader(
        readable: IReadable,
        targetEntity: FileEntity,
        startTime: number,
        actor?: UserEntity,
    ): Promise<void> {
        const reader = await McapIndexedReader.Initialize({ readable });
        const rawTopics: ExtractedTopicInfo[] = [];

        if (reader.statistics) {
            for (const [channelId, count] of reader.statistics
                .channelMessageCounts) {
                const channel = reader.channelsById.get(channelId);
                if (channel) {
                    rawTopics.push({
                        name: channel.topic,
                        type:
                            channel.schemaId > 0
                                ? (reader.schemasById.get(channel.schemaId)
                                      ?.name ?? 'unknown')
                                : 'unknown',
                        nrMessages: count,
                    });
                }
            }
        } else {
            for (const channel of reader.channelsById.values()) {
                rawTopics.push({
                    name: channel.topic,
                    type:
                        reader.schemasById.get(channel.schemaId)?.name ??
                        'unknown',
                    nrMessages: 0n,
                });
            }
        }

        let fileDate: Date | undefined;
        if (reader.header) {
            // @ts-ignore
            const profileTime = reader.header.profileTime;
            if (profileTime) {
                fileDate = new Date(Number(profileTime / 1_000_000n));
            }
        }

        await this.finishExtraction(
            targetEntity,
            rawTopics,
            Number(await readable.size()),
            fileDate,
            'mcap_indexed_reader',
            startTime,
            actor,
        );
    }
}
