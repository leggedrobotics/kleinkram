import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Project from '@common/entities/project/project.entity';
import { AccessGroupRights, UserRole } from '@common/enum';

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
    ) {}

    async canAccessProject(
        userUUID: string,
        projectUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        const user = await this.userRepository.findOne({
            where: { uuid: userUUID },
        });
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const res = await this.projectRepository
            .createQueryBuilder('project')
            .leftJoin('project.project_accesses', 'projectAccesses')
            .leftJoin('projectAccesses.accessGroup', 'accessGroup')
            .leftJoin('accessGroup.users', 'users')
            .where('project.uuid = :uuid', { uuid: projectUUID })
            .andWhere('users.uuid = :user', { user: user.uuid })
            .andWhere('projectAccesses.rights >= :rights', {
                rights,
            })
            .getMany();
        return res.length > 0;
    }

    async canAccessProjectByName(
        userUUID: string,
        projectName: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        const project = await this.projectRepository.findOne({
            where: { name: projectName },
        });
        if (!project) {
            return false;
        }
        return this.canAccessProject(userUUID, project.uuid, rights);
    }

    async canCreateProject(userUUID: string) {
        const user = await this.userService.findOneByUUID(userUUID);
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        const canCreate = await this.accessGroupRepository
            .createQueryBuilder('access_group')
            .leftJoin('access_group.users', 'users')
            .leftJoin('access_group.project_accesses', 'project_accesses')
            .where('project_accesses.rights >= :rights', {
                rights: AccessGroupRights.CREATE,
            })
            .andWhere('users.uuid = :user', { user: user.uuid })
            .andWhere('access_group.personal = FALSE')
            .getCount();
        return canCreate > 0;
    }
}
