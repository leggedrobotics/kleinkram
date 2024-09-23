import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Project from '@common/entities/project/project.entity';
import { AccessGroupRights, UserRole } from '@common/enum';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';

@Injectable()
export class ProjectGuardService {
    constructor(
        private userService: UserService,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(ProjectAccessViewEntity)
        private projectAccessView: Repository<ProjectAccessViewEntity>,
    ) {}

    async canAccessProject(
        userUUID: string,
        projectUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!projectUUID || !userUUID) {
            return false;
        }
        const user = await this.userRepository.findOne({
            where: { uuid: userUUID },
        });

        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const res = await this.projectAccessView.exists({
            where: {
                projectUUID,
                userUUID,
                rights: MoreThanOrEqual(rights),
            },
        });
        if (!res) {
            console.log(
                `User ${userUUID} does not have access to project ${projectUUID} with rights ${rights}`,
            );
        }
        return res;
    }

    async canAccessProjectByName(
        userUUID: string,
        projectName: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!projectName || !userUUID) {
            return false;
        }
        const project = await this.projectRepository.findOne({
            where: { name: projectName },
        });
        if (!project) {
            return false;
        }
        return this.canAccessProject(userUUID, project.uuid, rights);
    }

    async canCreate(userUUID: string) {
        if (!userUUID) {
            return false;
        }
        const user = await this.userService.findOneByUUID(userUUID);
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        return this.accessGroupRepository
            .createQueryBuilder('access_group')
            .leftJoin('access_group.users', 'users')
            .andWhere('users.uuid = :user', { user: user.uuid })
            .andWhere('access_group.personal = false')
            .andWhere('access_group.inheriting = true')
            .getExists();
    }
}
