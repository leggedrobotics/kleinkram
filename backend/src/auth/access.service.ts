import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import User from '@common/entities/user/user.entity';
import { EntityManager, ILike, Repository } from 'typeorm';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@common/frontend_shared/enum';
import Project from '@common/entities/project/project.entity';
import { AuthRes } from './paramDecorator';
import ProjectAccess from '@common/entities/auth/project_access.entity';
import GroupMembership from '@common/entities/auth/group_membership.entity';
import { CountedAccessGroups } from './dto/CountedAccessGroups.dto';

@Injectable()
export class AccessService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(GroupMembership)
        private groupMembershipRepository: Repository<GroupMembership>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(ProjectAccess)
        private projectAccessRepository: Repository<ProjectAccess>,
        private readonly entityManager: EntityManager,
    ) {}

    async getAccessGroup(uuid: string) {
        return this.accessGroupRepository
            .createQueryBuilder('accessGroup')
            .withDeleted()
            .leftJoinAndSelect('accessGroup.memberships', 'memberships')
            .leftJoinAndSelect('memberships.user', 'user')
            .leftJoinAndSelect(
                'accessGroup.project_accesses',
                'project_accesses',
            )
            .leftJoinAndSelect('project_accesses.project', 'project')
            .leftJoinAndSelect('project.creator', 'projectCreator')
            .leftJoinAndSelect('accessGroup.creator', 'creator')
            .where('accessGroup.uuid = :uuid', { uuid })
            .getOneOrFail();
    }

    async createAccessGroup(name: string, auth: AuthRes) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
        });

        const newGroup = this.accessGroupRepository.create({
            name,
            type: AccessGroupType.CUSTOM,
            memberships: [
                {
                    user: { uuid: user.uuid },
                    expirationDate: undefined,
                },
            ],
            creator: user,
        });
        return await this.accessGroupRepository.save(newGroup);
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
            relations: ['memberships', 'memberships.accessGroup'],
        });

        const personalAccessGroup = dbuser.memberships.find(
            (accessGroup) =>
                accessGroup.accessGroup.type === AccessGroupType.PRIMARY,
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
                            relations: ['memberships'],
                        },
                    );
                const user = await transactionalEntityManager.findOneOrFail(
                    User,
                    {
                        where: { uuid: userUUID },
                    },
                );
                const agu = transactionalEntityManager.create(GroupMembership, {
                    expirationDate: undefined,
                });
                await transactionalEntityManager.save(agu);
                await transactionalEntityManager
                    .createQueryBuilder()
                    .relation(AccessGroup, 'memberships')
                    .of(accessGroup)
                    .add(agu);
                await transactionalEntityManager
                    .createQueryBuilder()
                    .relation(User, 'memberships')
                    .of(user)
                    .add(agu);
                return await transactionalEntityManager.findOneOrFail(
                    AccessGroup,
                    {
                        where: { uuid: accessGroupUUID },
                        relations: ['memberships', 'memberships.user'],
                    },
                );
            },
        );
    }

    async removeUserFromAccessGroup(
        accessGroupUUID: string,
        userUUID: string,
    ): Promise<AccessGroup> {
        await this.groupMembershipRepository.delete({
            accessGroup: { uuid: accessGroupUUID },
            user: { uuid: userUUID },
        });

        return this.accessGroupRepository.findOneOrFail({
            where: { uuid: accessGroupUUID },
            relations: ['memberships', 'memberships.user'],
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
        const where = { type: AccessGroupType.CUSTOM };
        if (search) {
            where['name'] = ILike(`%${search}%`);
        }
        if (personal) {
            where['type'] = AccessGroupType.PRIMARY;
        }
        if (creator) {
            where['creator'] = { uuid: auth.user.uuid };
        }
        if (member) {
            // user in users of access group
            where['memberships'] = { user: { uuid: auth.user.uuid } };
        }
        const [found, count] = await this.accessGroupRepository.findAndCount({
            where,
            skip,
            take,
            relations: [
                'memberships',
                'memberships.user',
                'project_accesses',
                'project_accesses.project',
                'creator',
            ],
        });
        return { entities: found, total: count } as CountedAccessGroups;
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
            relations: ['memberships', 'memberships.user'],
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
    ) {
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
            relations: ['project', 'accessGroup'],
        });
    }

    async updateProjectAccess(
        projectUUID: string,
        groupUuid: string,
        rights: AccessGroupRights,
        auth: AuthRes,
    ) {
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

        return await this.projectAccessRepository.upsert(
            {
                rights,
                project: { uuid: projectUUID },
                accessGroup: { uuid: groupUuid },
            },
            { conflictPaths: ['project.uuid', 'accessGroup.uuid'] },
        );
    }

    async setExpireDate(uuid: string, expireDate: Date | null) {
        const agu = await this.groupMembershipRepository.findOneOrFail({
            where: { uuid },
        });
        agu.expirationDate = expireDate;
        return this.groupMembershipRepository.save(agu);
    }
}
