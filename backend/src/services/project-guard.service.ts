import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Project from '@common/entities/project/project.entity';
import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@common/frontend_shared/enum';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import logger from '../logger';

@Injectable()
export class ProjectGuardService {
    constructor(
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(ProjectAccessViewEntity)
        private projectAccessView: Repository<ProjectAccessViewEntity>,
    ) {}

    async canAccessProject(
        user: User,
        projectUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!projectUUID || !user) {
            return false;
        }

        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const res = await this.projectAccessView.exists({
            where: {
                projectUUID,
                userUUID: user.uuid,
                rights: MoreThanOrEqual(rights),
            },
        });
        if (!res) {
            logger.debug(
                `User ${user.name} (${user.uuid}) does not have access to project ${projectUUID} with rights ${rights.toString()}`,
            );
        }
        return res;
    }

    async canAccessProjectByName(
        user: User,
        projectName: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
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

    async canCreate(user: User) {
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
