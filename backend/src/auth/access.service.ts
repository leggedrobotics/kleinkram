import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import User from '@common/entities/user/user.entity';
import { Repository } from 'typeorm';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { AccessGroupRights } from '@common/enum';
import Project from '@common/entities/project/project.entity';
import { JWTUser } from './paramDecorator';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import ProjectAccess from '@common/entities/auth/project_access.entity';

@Injectable()
export class AccessService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(ProjectAccess)
        private projectAccessRepository: Repository<ProjectAccess>,
    ) {}

    async createAccessGroup(name: string, jwtuser: JWTUser) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: jwtuser.uuid },
        });

        const new_group = this.accessGroupRepository.create({
            name,
            personal: false,
            inheriting: false,
            users: [user],
        });
        return this.accessGroupRepository.save(new_group);
    }
    async canAddAccessGroup(
        uuid: string,
        user: JWTUser,
        rights: AccessGroupRights = AccessGroupRights.WRITE,
    ): Promise<boolean> {
        return this.projectRepository
            .createQueryBuilder('project')
            .leftJoin('project.project_accesses', 'projectAccesses')
            .leftJoin('projectAccesses.accessGroup', 'accessGroup')
            .leftJoin('accessGroup.users', 'users')
            .where('project.uuid = :uuid', { uuid })
            .andWhere('users.uuid = :user_uuid', { user_uuid: user.uuid })
            .andWhere('projectAccesses.rights >= :rights', {
                rights: rights,
            })
            .getExists();
    }

    async addUserToProject(
        projectUUID: string,
        userUUID: string,
        rights: AccessGroupRights,
    ): Promise<Project> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: ['project_accesses', 'project_accesses.accessGroup'],
        });
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
            relations: ['accessGroups'],
        });
        const personalAccessGroup = user.accessGroups.find(
            (accessGroup) => accessGroup.personal,
        );
        if (rights === AccessGroupRights.DELETE) {
            const canDelete = await this.canAddAccessGroup(
                projectUUID,
                { uuid: userUUID },
                AccessGroupRights.DELETE,
            );
            if (!canDelete) {
                throw new ConflictException(
                    'User cannot grant delete rights without having delete rights himself/herself',
                );
            }
        }

        const existingAccess = await this.projectAccessRepository
            .createQueryBuilder('projectAccess')
            .leftJoin('projectAccess.accessGroup', 'accessGroup')
            .leftJoin('projectAccess.projects', 'projects')
            .where('projectAccess.projects.uuid = :projectUUID', {
                projectUUID,
            })
            .andWhere('accessGroup.uuid = :accessGroupUUID', {
                accessGroupUUID: personalAccessGroup.uuid,
            })
            .getOne();
        if (existingAccess) {
            if (existingAccess.rights >= rights) {
                return project;
            }
            existingAccess.rights = rights;
            await this.projectAccessRepository.save(existingAccess);
            return this.projectRepository.findOneOrFail({
                where: { uuid: projectUUID },
                relations: ['project_accesses', 'project_accesses.accessGroup'],
            });
        }

        if (!personalAccessGroup) {
            throw new ConflictException('User has no personal access group');
        }

        const projectAccess = this.projectAccessRepository.create({
            rights: rights,
            accessGroup: personalAccessGroup,
            projects: project,
        });
        await this.projectAccessRepository.save(projectAccess);
        return this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: ['project_accesses', 'project_accesses.accessGroup'],
        });
    }
    async addUserToAccessGroup(
        accessGroupUUID: string,
        userUUID: string,
    ): Promise<AccessGroup> {
        const accessGroup = await this.accessGroupRepository.findOneOrFail({
            where: { uuid: accessGroupUUID },
            relations: ['users'],
        });
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        accessGroup.users.push(user);
        return this.accessGroupRepository.save(accessGroup);
    }

    async searchAccessGroup(search: string, user: JWTUser) {
        return this.accessGroupRepository
            .createQueryBuilder('accessGroup')
            .where('accessGroup.name ILIKE :search', { search: `%${search}%` })
            .andWhere('accessGroup.inheriting = false')
            .andWhere('accessGroup.personal = false')
            .getMany();
    }
}
