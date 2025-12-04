import FileEventEntity from '@kleinkram/backend-common/entities/file/file-event.entity';
import FileEntity from '@kleinkram/backend-common/entities/file/file.entity';
import TopicEntity from '@kleinkram/backend-common/entities/topic/topic.entity';
import UserEntity from '@kleinkram/backend-common/entities/user/user.entity';
import { FileEventType, FileState } from '@kleinkram/shared';
import { Repository } from 'typeorm';
import logger from '../../logger';
import { ExtractedTopicInfo } from './file-handler.interface';

export abstract class AbstractMetadataService {
    constructor(
        protected readonly topicRepo: Repository<TopicEntity>,
        protected readonly fileRepo: Repository<FileEntity>,
        protected readonly fileEventRepo: Repository<FileEventEntity>,
    ) {}

    /**
     * Common logic to finalize metadata extraction.
     * Handles deduplication, saving entities, and logging the timed event.
     */
    protected async finishExtraction(
        targetEntity: FileEntity,
        rawTopics: ExtractedTopicInfo[],
        fileSize: number,
        fileDate: Date | undefined,
        method: string,
        startTime: number,
        actor?: UserEntity,
    ): Promise<void> {
        try {
            // Deduplicate topics and sum counts
            const uniqueTopicsMap = new Map<string, ExtractedTopicInfo>();

            for (const t of rawTopics) {
                if (!t.name) continue;
                if (uniqueTopicsMap.has(t.name)) {
                    const existing = uniqueTopicsMap.get(t.name);
                    if (existing === undefined) continue;
                    existing.nrMessages = existing.nrMessages + t.nrMessages;
                } else {
                    uniqueTopicsMap.set(t.name, t);
                }
            }

            const uniqueTopics = [...uniqueTopicsMap.values()];

            // Save Topics
            if (uniqueTopics.length > 0) {
                const topicEntities = uniqueTopics.map((t) =>
                    this.topicRepo.create({
                        name: t.name,
                        type: t.type,
                        nrMessages: t.nrMessages,
                        frequency: 0,
                        file: targetEntity,
                    }),
                );
                await this.topicRepo.save(topicEntities, { chunk: 100 });
            }

            // Update File Entity
            if (fileDate) {
                targetEntity.date = fileDate;
            }
            targetEntity.state = FileState.OK;
            targetEntity.size = fileSize;
            await this.fileRepo.save(targetEntity);

            // Calculate Duration
            const durationMs = Date.now() - startTime;

            // Create Event
            await this.fileEventRepo.save(
                this.fileEventRepo.create({
                    file: targetEntity,
                    ...(targetEntity.mission
                        ? { mission: targetEntity.mission }
                        : {}),
                    ...(actor ? { actor } : {}),
                    type: FileEventType.TOPICS_EXTRACTED,
                    filenameSnapshot: targetEntity.filename,
                    details: {
                        topicCount: uniqueTopics.length,
                        method,
                        extractedAt: new Date(),
                        durationMs,
                    },
                }),
            );
        } catch (error) {
            logger.error(
                `Metadata extraction finalize failed for ${targetEntity.filename}: ${error}`,
            );
            targetEntity.state = FileState.CONVERSION_ERROR;
            await this.fileRepo.save(targetEntity);
            throw error;
        }
    }
}
