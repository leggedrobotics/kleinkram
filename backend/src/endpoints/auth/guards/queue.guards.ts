import { MissionGuardService } from '@/endpoints/auth/mission-guard.service';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { AccessGroupRights } from '@kleinkram/shared';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseGuard } from './base.guards';

/**
 * Authorizes the queue (ingestion job) routes `/files/queue/:uuid`.
 *
 * The route parameter is the uuid of the ingestion job, not of a mission, so the
 * mission that owns the job is resolved from the database. The mission uuid a
 * caller may pass in the body is never used for authorization: it only scopes
 * the subsequent lookup in the queue service.
 */
@Injectable()
export class QueueItemAccessGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        @InjectRepository(IngestionJobEntity)
        private ingestionJobRepository: Repository<IngestionJobEntity>,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const params = request.params as { uuid?: string } | undefined;
        const queueUUID = params?.uuid;

        if (!queueUUID) {
            return false; // Deny access if UUID not provided
        }

        const ingestionJob = await this.ingestionJobRepository.findOne({
            where: { uuid: queueUUID },
            relations: { mission: true },
        });

        const missionUUID = ingestionJob?.mission?.uuid;
        if (!missionUUID) {
            return false; // Deny access for unknown or orphaned queue entries
        }

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.DELETE,
            );
        }

        return this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            AccessGroupRights.DELETE,
        );
    }
}
