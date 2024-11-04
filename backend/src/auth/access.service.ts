import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import User from '@common/entities/user/user.entity';
import { EntityManager, ILike, Repository } from 'typeorm';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { AccessGroupRights, UserRole } from '@common/enum';
import Project from '@common/entities/project/project.entity';
import { AuthRes } from './paramDecorator';
import ProjectAccess from '@common/entities/auth/project_access.entity';
import AccessGroupUser from '@common/entities/auth/accessgroup_user.entity';

@Injectable()
export class AccessService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(AccessGroupUser)
        private accessGroupUserRepository: Repository<AccessGroupUser>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(ProjectAccess)
        private projectAccessRepository: Repository<ProjectAccess>,
        private readonly entityManager: EntityManager,
    ) {}

    async getAccessGroup(uuid: string) {
        return this.accessGroupRepository.findOneOrFail({
            where: { uuid },
            relations: [
                'accessGroupUsers',
                'accessGroupUsers.user',
                'project_accesses',
                'project_accesses.project',
                'project_accesses.project.creator',
                'creator',
            ],
        });
    }

    async createAccessGroup(name: string, auth: AuthRes) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
        });

        const newGroup = this.accessGroupRepository.create({
            name,
            personal: false,
            inheriting: false,
            accessGroupUsers: [],
            creator: user,
        });
        const saved = await this.accessGroupRepository.save(newGroup);
        const accessGroupUser = this.accessGroupUserRepository.create({
            accessGroup: { uuid: saved.uuid },
            user: { uuid: user.uuid },
            expirationDate: undefined,
        });
        await this.accessGroupUserRepository.save(accessGroupUser);
        return saved;
    }

    async hasProjectRights(
        projectUUID: string,
        auth: AuthRes,
        rights: AccessGroupRights = AccessGroupRights.WRITE,
    ): Promise<boolean> {
        const dbuser = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
        });
        if (dbuser.role === UserRole.ADMIN) {
            return true;
        }

        return this.projectRepository
            .createQueryBuilder('project')
            .leftJoin(
                'project_access_view_entity',
                'projectAccesses',
                'projectAccesses.projectuuid = project.uuid',
            )
            .where('project.uuid = :uuid', { uuid: projectUUID })
            .andWhere('projectAccesses.rights >= :rights', {
                rights: rights,
            })
            .andWhere('projectAccesses.useruuid = :user_uuid', {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                user_uuid: auth.user.uuid,
            })
            .getExists();
    }

    async addUserToProject(
        projectUUID: string,
        userUUID: string,
        rights: AccessGroupRights,
        auth: AuthRes,
    ): Promise<Project> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: ['project_accesses', 'project_accesses.accessGroup'],
        });
        const dbuser = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
            relations: ['accessGroupUsers', 'accessGroupUsers.accessGroup'],
        });

        const personalAccessGroup = dbuser.accessGroupUsers.find(
            (accessGroup) => accessGroup.accessGroup.personal,
        );
        const canUpdate = await this.hasProjectRights(
            projectUUID,
            auth,
            rights,
        );
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
        return await this.entityManager.transaction(
            async (transactionalEntityManager) => {
                const accessGroup =
                    await transactionalEntityManager.findOneOrFail(
                        AccessGroup,
                        {
                            where: { uuid: accessGroupUUID },
                            relations: ['users'],
                        },
                    );
                await transactionalEntityManager
                    .createQueryBuilder()
                    .relation(AccessGroup, 'users')
                    .of(accessGroup)
                    .add(userUUID);
                return await transactionalEntityManager.findOneOrFail(
                    AccessGroup,
                    {
                        where: { uuid: accessGroupUUID },
                        relations: ['users'],
                    },
                );
            },
        );
    }

    async removeUserFromAccessGroup(
        accessGroupUUID: string,
        userUUID: string,
    ): Promise<AccessGroup> {
        await this.accessGroupUserRepository.delete({
            accessGroup: { uuid: accessGroupUUID },
            user: { uuid: userUUID },
        });

        return this.accessGroupRepository.findOneOrFail({
            where: { uuid: accessGroupUUID },
            relations: ['accessGroupUsers', 'accessGroupUsers.user'],
        });
    }

    async searchAccessGroup(
        search: string,
        personal: boolean,
        creator: boolean,
        member: boolean,
        auth: AuthRes,
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
            where['creator'] = { uuid: auth.user.uuid };
        }
        if (member) {
            // user in in users of access group
            where['users'] = { uuid: auth.user.uuid };
        }
        return this.accessGroupRepository.findAndCount({
            where,
            skip,
            take,
            relations: [
                'accessGroupUsers',
                'accessGroupUsers.user',
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
        auth: AuthRes,
    ): Promise<Project> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: ['project_accesses', 'project_accesses.accessGroup'],
        });
        const accessGroup = await this.accessGroupRepository.findOneOrFail({
            where: { uuid: accessGroupUUID },
            relations: ['accessGroupUsers', 'accessGroupUsers.user'],
        });

        if (rights === AccessGroupRights.DELETE) {
            const canDelete = await this.hasProjectRights(
                projectUUID,
                auth,
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
        auth: AuthRes,
    ): Promise<AccessGroup> {
        const canDelete = await this.hasProjectRights(
            projectUUID,
            auth,
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

    async getProjectAccess(projectUUID: string, projectAccessUUID: string) {
        return this.projectAccessRepository.findOneOrFail({
            where: { uuid: projectAccessUUID, project: { uuid: projectUUID } },
            relations: ['project'],
        });
    }

    async updateProjectAccess(
        projectUUID: string,
        projectAccessUUID: string,
        rights: AccessGroupRights,
        auth: AuthRes,
    ) {
        const projectAccess = await this.projectAccessRepository.findOneOrFail({
            where: { uuid: projectAccessUUID, project: { uuid: projectUUID } },
        });

        if (rights === AccessGroupRights.DELETE) {
            const canDelete = await this.hasProjectRights(
                projectUUID,
                auth,
                AccessGroupRights.DELETE,
            );
            if (!canDelete) {
                throw new ConflictException(
                    'User cannot grant delete rights without having delete rights himself/herself',
                );
            }
        }

        projectAccess.rights = rights;
        await this.projectAccessRepository.save(projectAccess);
        return this.projectAccessRepository.findOneOrFail({
            where: { uuid: projectAccessUUID, project: { uuid: projectUUID } },
        });
    }
}
