import { AccessGroupEntity } from '@kleinkram/backend-common/entities/auth/accessgroup.entity';
import { GroupMembershipEntity } from '@kleinkram/backend-common/entities/auth/group-membership.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { UserRole } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import logger from '../../logger';

@Injectable()
export class AuthGuardService {
    constructor(
        @InjectRepository(AccessGroupEntity)
        private accessGroupRepository: Repository<AccessGroupEntity>,
        @InjectRepository(GroupMembershipEntity)
        private groupMembership: Repository<GroupMembershipEntity>,
    ) {}

    async canEditAccessGroupByProjectUuid(
        user: UserEntity,
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
        user: UserEntity,
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
