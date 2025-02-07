import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import User from '@common/entities/user/user.entity';
import {
    EntityManager,
    FindOptionsWhere,
    ILike,
    InsertResult,
    Not,
    Repository,
} from 'typeorm';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@common/frontend_shared/enum';
import Project from '@common/entities/project/project.entity';
import ProjectAccess from '@common/entities/auth/project-access.entity';
import GroupMembership from '@common/entities/auth/group-membership.entity';
import { AccessGroupDto, GroupMembershipDto } from '@common/api/types/user.dto';
import logger from '../logger';
import { AccessGroupsDto } from '@common/api/types/access-control/access-groups.dto';
import { ProjectAccessListDto } from '@common/api/types/access-control/project-access.dto';
import { ProjectWithMissionsDto } from '@common/api/types/project/project-with-missions.dto';
import { AuthHeader } from '../endpoints/auth/parameter-decorator';

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

    async getAccessGroup(uuid: string): Promise<AccessGroupDto> {
        const rawAccessGroup = await this.accessGroupRepository
            .createQueryBuilder('accessGroup')
            .withDeleted()
            .leftJoinAndSelect('accessGroup.memberships', 'memberships')
            .leftJoinAndSelect('memberships.user', 'user')
            .leftJoinAndSelect(
                'accessGroup.project_accesses',
                'project_accesses',
            )
            .leftJoinAndSelect('project_accesses.project', 'project')
            .leftJoinAndSelect('accessGroup.creator', 'creator')
            .where('accessGroup.uuid = :uuid', { uuid })
            .getOneOrFail();

        return {
            createdAt: rawAccessGroup.createdAt,
            creator: rawAccessGroup.creator?.userDto ?? null,
            hidden: rawAccessGroup.hidden,
            memberships:
                rawAccessGroup.memberships?.map(
                    (membership) => membership.groupMembershipDto,
                ) ?? [],
            name: rawAccessGroup.name,
            type: rawAccessGroup.type,
            updatedAt: rawAccessGroup.updatedAt,
            uuid: rawAccessGroup.uuid,
            projectAccesses:
                rawAccessGroup.project_accesses?.map(
                    (value) => value.projectsOfGroup,
                ) ?? [],
        };
    }

    async createAccessGroup(
        name: string,
        auth: AuthHeader,
    ): Promise<AccessGroup> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
        });

        const newGroup = this.accessGroupRepository.create({
            name,
            type: AccessGroupType.CUSTOM,
            memberships: [
                {
                    user: { uuid: user.uuid },
                    canEditGroup: true, // the creator can always edit the group
                },
            ],
            creator: user,
        });

        return (await this.accessGroupRepository.save(
            newGroup,
        )) as unknown as AccessGroup;
    }

    async hasProjectRights(
        projectUUID: string,
        auth: AuthHeader,
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
        auth: AuthHeader,
    ): Promise<Project> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: ['project_accesses', 'project_accesses.accessGroup'],
        });
        const dbuser = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
            relations: ['memberships', 'memberships.accessGroup'],
        });

        if (dbuser.memberships === undefined)
            throw new Error('User has no memberships');

        const personalAccessGroup = dbuser.memberships.find(
            (accessGroup) =>
                accessGroup.accessGroup?.type === AccessGroupType.PRIMARY,
        );

        if (personalAccessGroup === undefined)
            throw new Error('User has no personal access group');

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

                // @ts-ignore
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
        const usersWithEditRights = await this.groupMembershipRepository.count({
            where: {
                accessGroup: { uuid: accessGroupUUID },
                // where user is NOT matching userUUID
                user: { uuid: Not(userUUID) },
                canEditGroup: true,
            },
        });

        if (usersWithEditRights === 0) {
            throw new ConflictException(
                'Cannot remove the last user with edit rights',
            );
        }

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
        type: AccessGroupType | undefined,
        skip: number,
        take: number,
    ): Promise<AccessGroupsDto> {
        // we only list the access groups that are not hidden
        const where: FindOptionsWhere<AccessGroup> = {
            hidden: false,
        };

        if (type !== undefined) {
            where.type = type;
        }

        if (search !== '') {
            where.name = ILike(`%${search}%`);
        }

        const [accessGroups, count] =
            await this.accessGroupRepository.findAndCount({
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

        logger.debug(`Search access group with name containing '${search}'`);
        logger.debug(`Found ${count.toString()} access groups`);

        const data: AccessGroupDto[] = accessGroups.map(
            (accessGroup: AccessGroup): AccessGroupDto => {
                return {
                    // eslint-disable-next-line unicorn/no-null
                    creator: accessGroup.creator?.userDto ?? null,
                    memberships:
                        accessGroup.memberships?.map(
                            (m) => m.groupMembershipDto,
                        ) ?? [],
                    createdAt: accessGroup.createdAt,
                    updatedAt: accessGroup.updatedAt,
                    uuid: accessGroup.uuid,
                    name: accessGroup.name,
                    type: accessGroup.type,
                    hidden: accessGroup.hidden,
                    projectAccesses: [],
                };
            },
        );

        return { data, count, skip, take };
    }

    async addAccessGroupToProject(
        projectUUID: string,
        accessGroupUUID: string,
        rights: AccessGroupRights,
        auth: AuthHeader,
    ): Promise<ProjectWithMissionsDto> {
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
                return project as unknown as ProjectWithMissionsDto;
            }
            existingAccess.rights = rights;
            await this.projectAccessRepository.save(existingAccess);
            return this.projectRepository.findOneOrFail({
                where: { uuid: projectUUID },
            }) as unknown as ProjectWithMissionsDto;
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
        }) as unknown as ProjectWithMissionsDto;
    }

    async removeAccessGroupFromProject(
        projectUUID: string,
        accessGroupUUID: string,
        auth: AuthHeader,
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

    async deleteAccessGroup(uuid: string): Promise<void> {
        const accessGroup = await this.accessGroupRepository.findOneOrFail({
            where: { uuid },
        });

        await this.accessGroupRepository.remove(accessGroup);
        return;
    }

    async getProjectAccesses(
        projectUUID: string,
    ): Promise<ProjectAccessListDto> {
        const [access, count] = await this.projectAccessRepository.findAndCount(
            {
                where: { project: { uuid: projectUUID } },
                order: { accessGroup: { name: 'ASC' } },
                relations: [
                    'project',
                    'accessGroup',
                    'accessGroup.memberships',
                ],
            },
        );

        return {
            data: access.map((a) => a.projectAccessDto),
            count,
            take: count,
            skip: 0,
        };
    }

    async updateProjectAccess(
        projectUUID: string,
        groupUuid: string,
        rights: AccessGroupRights,
        auth: AuthHeader,
    ): Promise<InsertResult> {
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

    async setExpireDate(
        uuid: string,
        userUuid: string,
        expireDate: Date | 'never',
    ): Promise<GroupMembershipDto> {
        const agu = await this.groupMembershipRepository.findOneOrFail({
            where: {
                accessGroup: { uuid },
                user: { uuid: userUuid },
            },
        });
        // TODO: check how to properly set the expireDate to null in a type-safe way
        // @ts-ignore
        agu.expirationDate = expireDate === 'never' ? null : expireDate;
        const { uuid: membershipUuid } =
            await this.groupMembershipRepository.save(agu);

        // fetch the saved membership to get the updated expirationDate
        const savedMembership =
            await this.groupMembershipRepository.findOneOrFail({
                where: { uuid: membershipUuid },
                relations: ['user'],
            });
        return savedMembership.groupMembershipDto;
    }
}
