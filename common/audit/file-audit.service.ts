import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import FileEventEntity from '../entities/file/file-event.entity';
import FileEntity from '../entities/file/file.entity';
import MissionEntity from '../entities/mission/mission.entity';
import { AuditActionType, AuditContext } from './audit.types';

@Injectable()
export class FileAuditService {
    private readonly logger = new Logger(FileAuditService.name);

    constructor(
        @InjectRepository(FileEventEntity)
        private readonly eventRepo: Repository<FileEventEntity>,
        @InjectRepository(FileEntity)
        private readonly fileRepo: Repository<FileEntity>,
        @InjectRepository(MissionEntity)
        private readonly missionRepo: Repository<MissionEntity>,
    ) {}

    async log(
        action: AuditActionType,
        context: AuditContext,
        isSuccess: boolean,
        error?: string,
    ): Promise<void> {
        try {
            // Resolve File and Mission Relations
            let file: FileEntity | undefined = undefined;
            let mission: MissionEntity | undefined = undefined;

            if (context.fileUuid) {
                file =
                    (await this.fileRepo.findOne({
                        where: { uuid: context.fileUuid },
                        relations: ['mission'],
                    })) ?? undefined;
                mission = file?.mission ?? undefined;
            }

            // Fallback: Try to find mission if explicitly provided
            if (!mission && context.missionUuid) {
                mission =
                    (await this.missionRepo.findOne({
                        where: { uuid: context.missionUuid },
                    })) ?? undefined;
            }

            if (file === undefined) {
                return; // abort logging if file not found
            }

            // Construct the Event
            const event = this.eventRepo.create({
                type: action, // Ensure this matches your FileEventType enum
                file: file,
                filenameSnapshot:
                    context.filename || file?.filename || 'UNKNOWN',
                details: {
                    ...context.details,
                    success: isSuccess,
                    error,
                },
                ...(mission ? { mission } : {}),
                ...(context.actor ? { actor: context.actor } : {}),
                ...(context.action ? { action: context.action } : {}),
            });

            await this.eventRepo.save(event);
        } catch (databaseError) {
            // Fail-safe: Don't crash the main request if audit logging fails
            this.logger.error(
                `Failed to save audit log for ${action}: ${databaseError}`,
            );
        }
    }
}
