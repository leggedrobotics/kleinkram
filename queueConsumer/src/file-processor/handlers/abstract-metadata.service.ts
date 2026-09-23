import { FileEventEntity } from '@kleinkram/backend-common/entities/file/file-event.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { FileEventType, FileState } from '@kleinkram/shared';
import { Repository } from 'typeorm';
import logger from '../../logger';
import { ExtractedTopicInfo } from './file-handler.interface';
import { RecordingTimes } from './time';

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
        recordingTimes: RecordingTimes,
        method: string,
        startTime: number,
        actor?: UserEntity,
    ): Promise<void> {
        try {
            // Deduplicate topics and sum counts
            const uniqueTopicsMap = new Map<string, ExtractedTopicInfo>();

            for (const t of rawTopics) {
                if (!t.name) continue;
                const topicFrequency = this.normalizeFrequency(t.frequency);
                if (uniqueTopicsMap.has(t.name)) {
                    const existing = uniqueTopicsMap.get(t.name);
                    if (existing === undefined) continue;
                    existing.nrMessages = existing.nrMessages + t.nrMessages;
                    existing.frequency = existing.frequency + topicFrequency;
                } else {
                    uniqueTopicsMap.set(t.name, {
                        ...t,
                        frequency: topicFrequency,
                    });
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
                        frequency: this.normalizeFrequency(t.frequency),
                        file: targetEntity,
                    }),
                );
                await this.topicRepo.save(topicEntities, { chunk: 100 });
            }

            // Update File Entity
            applyRecordingTimes(targetEntity, recordingTimes);
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
                        ...(recordingTimes.startDate
                            ? {
                                  recordingStartDate:
                                      recordingTimes.startDate.toISOString(),
                              }
                            : {}),
                        ...(recordingTimes.endDate
                            ? {
                                  recordingEndDate:
                                      recordingTimes.endDate.toISOString(),
                              }
                            : {}),
                    },
                }),
            );
        } catch (error: unknown) {
            logger.error(
                `Metadata extraction finalize failed for ${targetEntity.filename}: ${String(error)}`,
            );
            targetEntity.state = FileState.CONVERSION_ERROR;
            await this.fileRepo.save(targetEntity);
            throw error;
        }
    }

    private normalizeFrequency(value: number): number {
        if (!Number.isFinite(value)) return 0;
        if (value < 0) return 0;
        return value;
    }
}

/**
 * The columns the extracted recording bounds are written to.
 *
 * `date` is what the API sorts and filters by, so it follows the recording
 * start as soon as we know it; without a start it keeps the upload time the
 * file was created with rather than being cleared. Bounds we do not know are
 * left out entirely, so that a later pass can still fill them in.
 */
export function recordingTimeColumns(
    recordingTimes: RecordingTimes,
): Partial<
    Pick<FileEntity, 'date' | 'recordingStartDate' | 'recordingEndDate'>
> {
    return {
        ...(recordingTimes.startDate
            ? {
                  date: recordingTimes.startDate,
                  recordingStartDate: recordingTimes.startDate,
              }
            : {}),
        ...(recordingTimes.endDate
            ? { recordingEndDate: recordingTimes.endDate }
            : {}),
    };
}

/**
 * Copies the extracted recording bounds onto the file.
 */
export function applyRecordingTimes(
    file: FileEntity,
    recordingTimes: RecordingTimes,
): void {
    Object.assign(file, recordingTimeColumns(recordingTimes));
}
