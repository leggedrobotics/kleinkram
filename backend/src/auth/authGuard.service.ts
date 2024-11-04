import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { Repository } from 'typeorm';
import { UserRole } from '@common/enum';
import User from '@common/entities/user/user.entity';
import logger from '../logger';

@Injectable()
export class AuthGuardService {
    constructor(
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {}

    async canAddUserToAccessGroup(user: User, accessGroupUUID: string) {
        if (!user || !accessGroupUUID) {
            logger.error(
                `AuthGuard: accessGroupUUID (${accessGroupUUID}) or User (${user}) not provided.`,
            );
            return false;
        }
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        return await this.accessGroupRepository.exists({
            where: { uuid: accessGroupUUID, creator: { uuid: user.uuid } },
            relations: ['accessGroupUsers', 'accessGroupUsers.user'],
        });
    }

    async isAccessGroupCreatorByProjectAccess(
        user: User,
        projectAccessUUID: string,
    ) {
        if (!user || !projectAccessUUID) {
            logger.error(
                `AuthGuard: projectAccessUUID (${projectAccessUUID}) or User (${user}) not provided.`,
            );
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        return await this.accessGroupRepository.exists({
            where: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                project_accesses: { uuid: projectAccessUUID },
                creator: { uuid: user.uuid },
            },
        });
    }
}
