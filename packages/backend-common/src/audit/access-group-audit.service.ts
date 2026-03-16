import { AccessGroupEventType } from '@kleinkram/shared';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGroupEventEntity } from '../entities/auth/access-group-event.entity';
import { AccessGroupEntity } from '../entities/auth/access-group.entity';
import { UserEntity } from '../entities/user/user.entity';

@Injectable()
export class AccessGroupAuditService {
    private readonly logger = new Logger(AccessGroupAuditService.name);

    constructor(
        @InjectRepository(AccessGroupEventEntity)
        private readonly eventRepo: Repository<AccessGroupEventEntity>,
        @InjectRepository(AccessGroupEntity)
        private readonly groupRepo: Repository<AccessGroupEntity>,
    ) {}

    async log(
        accessGroupUuid: string,
        action: AccessGroupEventType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        details: Record<string, any>,
        actor?: UserEntity,
    ): Promise<void> {
        try {
            const group = await this.groupRepo.findOne({
                where: { uuid: accessGroupUuid },
            });

            if (!group) {
                this.logger.warn(
                    `Cannot log event: Access group ${accessGroupUuid} not found`,
                );
                return;
            }

            const event = this.eventRepo.create({
                type: action,
                details,
                accessGroup: group,
                ...(actor ? { actor } : {}),
            });

            await this.eventRepo.save(event);
        } catch (databaseError) {
            // Fail-safe: Don't crash the main request if audit logging fails
            this.logger.error(
                `Failed to save audit log for group ${accessGroupUuid} / action ${action}: ${String(databaseError)}`,
            );
        }
    }

    async getLogsForGroup(
        accessGroupUuid: string,
    ): Promise<[AccessGroupEventEntity[], number]> {
        return this.eventRepo.findAndCount({
            where: { accessGroup: { uuid: accessGroupUuid } },
            relations: ['actor'],
            order: { createdAt: 'DESC' },
        });
    }
}
