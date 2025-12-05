import { AccessGroupEntity } from '@kleinkram/backend-common/entities/auth/accessgroup.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { ProjectAccessViewEntity } from '@kleinkram/backend-common/viewEntities/project-access-view.entity';
import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import logger from '../logger';

@Injectable()
export class ProjectGuardService {
    constructor(
        @InjectRepository(AccessGroupEntity)
        private accessGroupRepository: Repository<AccessGroupEntity>,
        @InjectRepository(ProjectEntity)
        private projectRepository: Repository<ProjectEntity>,
        @InjectRepository(ProjectAccessViewEntity)
        private projectAccessView: Repository<ProjectAccessViewEntity>,
    ) {}

    async canAccessProject(
        user: UserEntity,
        projectUuid: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!projectUuid || !user) {
            return false;
        }

        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const isExisting = await this.projectAccessView.exists({
            where: {
                projectUuid: projectUuid,
                userUuid: user.uuid,
                rights: MoreThanOrEqual(rights),
            },
        });
        if (!isExisting) {
            logger.debug(
                `User ${user.name} (${user.uuid}) does not have access to project ${projectUuid} with rights ${rights.toString()}`,
            );
        }
        return isExisting;
    }

    async canAccessProjectByName(
        user: UserEntity,
        projectName: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!projectName || !user) {
            return false;
        }
        const project = await this.projectRepository.findOne({
            where: { name: projectName },
        });
        if (!project) {
            return false;
        }
        return this.canAccessProject(user, project.uuid, rights);
    }

    async canCreate(user: UserEntity): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        return this.accessGroupRepository
            .createQueryBuilder('access_group')
            .leftJoin('access_group.memberships', 'memberships')
            .leftJoin('memberships.user', 'user')
            .andWhere('user.uuid = :user', { user: user.uuid })
            .andWhere('access_group.type = :type', {
                type: AccessGroupType.AFFILIATION,
            })
            .getExists();
    }
}
