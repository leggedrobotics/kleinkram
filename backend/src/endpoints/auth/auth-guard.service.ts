import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { Repository } from 'typeorm';
import { UserRole } from '@common/frontend_shared/enum';
import User from '@common/entities/user/user.entity';
import logger from '../../logger';
import GroupMembership from '@common/entities/auth/group-membership.entity';

@Injectable()
export class AuthGuardService {
    constructor(
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(GroupMembership)
        private groupMembership: Repository<GroupMembership>,
    ) {}

    async canEditAccessGroupByProjectUuid(
        user: User,
        projectAccessUUID: string,
    ): Promise<boolean> {
        if (!user || !projectAccessUUID) {
            logger.error(
                `AuthGuard: projectAccessUUID (${projectAccessUUID}) or User (${user.uuid}) not provided.`,
            );
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        return await this.accessGroupRepository.exists({
            where: {
                project_accesses: { uuid: projectAccessUUID },
                creator: { uuid: user.uuid },
            },
        });
    }

    async canEditAccessGroupByGroupUuid(
        user: User,
        uuid: string,
    ): Promise<boolean> {
        if (!user || !uuid) {
            logger.error(
                `AuthGuard: aguUUID (${uuid}) or User (${user.uuid}) not provided.`,
            );
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        return await this.groupMembership.exists({
            where: {
                accessGroup: { uuid },
                user: { uuid: user.uuid },
                canEditGroup: true,
            },
        });
    }
}
