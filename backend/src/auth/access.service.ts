import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import User from '@common/entities/user/user.entity';
import { ILike, Repository } from 'typeorm';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { AccessGroupRights, UserRole } from '@common/enum';
import Project from '@common/entities/project/project.entity';
import { JWTUser } from './paramDecorator';
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
    async getAccessGroup(uuid: string, jwtuser: JWTUser) {
        return this.accessGroupRepository.findOneOrFail({
            where: { uuid },
            relations: [
                'users',
                'project_accesses',
                'project_accesses.project',
                'project_accesses.project.creator',
                'creator',
            ],
        });
    }
    async createAccessGroup(name: string, jwtuser: JWTUser) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: jwtuser.uuid },
        });

        const new_group = this.accessGroupRepository.create({
            name,
            personal: false,
            inheriting: false,
            users: [user],
            creator: user,
        });
        return this.accessGroupRepository.save(new_group);
    }
    async canModifyAccessGroup(
        uuid: string,
        user: JWTUser,
        rights: AccessGroupRights = AccessGroupRights.WRITE,
    ): Promise<boolean> {
        const dbuser = await this.userRepository.findOneOrFail({
            where: { uuid: user.uuid },
        });
        if (dbuser.role === UserRole.ADMIN) {
            return true;
        }
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
        user: JWTUser,
    ): Promise<Project> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: ['project_accesses', 'project_accesses.accessGroup'],
        });
        const dbuser = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
            relations: ['accessGroups'],
        });

        const modifyingUser = await this.userRepository.findOneOrFail({
            where: { uuid: user.uuid },
            relations: ['accessGroups'],
        });

        const personalAccessGroup = dbuser.accessGroups.find(
            (accessGroup) => accessGroup.personal,
        );
        const canUpdate =
            (await this.canModifyAccessGroup(projectUUID, user, rights)) ||
            modifyingUser.role === UserRole.ADMIN;
        if (rights === AccessGroupRights.DELETE && !canUpdate) {
            throw new ConflictException(
                'User cannot grant delete rights without having delete rights himself/herself',
            );
        }

        const existingAccess = await this.projectAccessRepository
            .createQueryBuilder('projectAccess')
            .leftJoin('projectAccess.accessGroup', 'accessGroup')
            .leftJoin('projectAccess.project', 'project')
            .where('project.uuid = :projectUUID', {
                projectUUID,
            })
            .andWhere('accessGroup.uuid = :accessGroupUUID', {
                accessGroupUUID: personalAccessGroup.uuid,
            })
            .getOne();
        if (existingAccess) {
            if (existingAccess.rights >= rights && !canUpdate) {
                throw new ConflictException(
                    'User cannot decrease rights without having the same rights himself/herself',
                );
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
            project: project,
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

    async removeUserFromAccessGroup(
        accessGroupUUID: string,
        userUUID: string,
    ): Promise<AccessGroup> {
        const accessGroup = await this.accessGroupRepository.findOneOrFail({
            where: { uuid: accessGroupUUID },
            relations: ['users'],
        });

        accessGroup.users = accessGroup.users.filter(
            (u) => u.uuid !== userUUID,
        );
        return this.accessGroupRepository.save(accessGroup);
    }

    async searchAccessGroup(
        search: string,
        personal: boolean,
        creator: boolean,
        member: boolean,
        user: JWTUser,
        skip: number,
        take: number,
    ) {
        const where = { inheriting: false, personal: false };
        if (search) {
            where['name'] = ILike(`%${search}%`);
        }
        if (personal) {
            where['personal'] = true;
        }
        if (creator) {
            where['creator'] = { uuid: user.uuid };
        }
        if (member) {
            // user in in users of access group
            where['users'] = { uuid: user.uuid };
        }
        return this.accessGroupRepository.findAndCount({
            where,
            skip,
            take,
            relations: [
                'users',
                'project_accesses',
                'project_accesses.project',
                'creator',
            ],
        });
    }

    async addAccessGroupToProject(
        projectUUID: string,
        accessGroupUUID: string,
        rights: AccessGroupRights,
        jwtuser: JWTUser,
    ): Promise<Project> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: ['project_accesses', 'project_accesses.accessGroup'],
        });
        const accessGroup = await this.accessGroupRepository.findOneOrFail({
            where: { uuid: accessGroupUUID },
            relations: ['users'],
        });

        if (rights === AccessGroupRights.DELETE) {
            const canDelete = await this.canModifyAccessGroup(
                projectUUID,
                { uuid: jwtuser.uuid },
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
            .leftJoin('projectAccess.project', 'project')
            .where('project.uuid = :projectUUID', {
                projectUUID,
            })
            .andWhere('accessGroup.uuid = :accessGroupUUID', {
                accessGroupUUID,
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

        const projectAccess = this.projectAccessRepository.create({
            rights: rights,
            accessGroup: accessGroup,
            project: project,
        });
        await this.projectAccessRepository.save(projectAccess);
        return this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: ['project_accesses', 'project_accesses.accessGroup'],
        });
    }

    async removeAccessGroupFromProject(
        projectUUID: string,
        accessGroupUUID: string,
        jwtuser: JWTUser,
    ): Promise<AccessGroup> {
        const canDelete = await this.canModifyAccessGroup(
            projectUUID,
            { uuid: jwtuser.uuid },
            AccessGroupRights.DELETE,
        );
        if (!canDelete) {
            throw new ConflictException(
                'User cannot remove access group without having delete rights himself/herself',
            );
        }

        const projectAccess = await this.projectAccessRepository.find({
            where: {
                project: { uuid: projectUUID },
                accessGroup: { uuid: accessGroupUUID },
            },
        });
        await this.projectAccessRepository.remove(projectAccess);
        return this.accessGroupRepository.findOneOrFail({
            where: { uuid: accessGroupUUID },
            relations: ['users'],
        });
    }

    async deleteAccessGroup(uuid: string) {
        const accessGroup = await this.accessGroupRepository.findOneOrFail({
            where: { uuid },
        });

        await this.accessGroupRepository.remove(accessGroup);
        return;
    }
}
