import { AccessGroupsDto } from '@common/api/types/access-control/access-groups.dto';
import {
    ProjectAccessDto,
    ProjectAccessListDto,
} from '@common/api/types/access-control/project-access.dto';
import { ProjectWithAccessRightsDto } from '@common/api/types/project/project-access.dto';
import { ProjectWithMissionsDto } from '@common/api/types/project/project-with-missions.dto';
import { AccessGroupDto, GroupMembershipDto } from '@common/api/types/user.dto';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import GroupMembership from '@common/entities/auth/group-membership.entity';
import ProjectAccess from '@common/entities/auth/project-access.entity';
import Project from '@common/entities/project/project.entity';
import User from '@common/entities/user/user.entity';
import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@common/frontend_shared/enum';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    EntityManager,
    FindOptionsWhere,
    ILike,
    MoreThanOrEqual,
    Not,
    Repository,
} from 'typeorm';
import { AuthHeader } from '../endpoints/auth/parameter-decorator';
import logger from '../logger';
import {
    groupMembershipEntityToDto,
    projectAccessEntityToDto,
    userEntityToDto,
} from '../serialization';

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
            creator: rawAccessGroup.creator
                ? userEntityToDto(rawAccessGroup.creator)
                : null,
            hidden: rawAccessGroup.hidden,
            memberships:
                rawAccessGroup.memberships?.map(groupMembershipEntityToDto) ??
                [],
            name: rawAccessGroup.name,
            type: rawAccessGroup.type,
            updatedAt: rawAccessGroup.updatedAt,
            uuid: rawAccessGroup.uuid,
            projectAccesses:
                rawAccessGroup.project_accesses?.map(
                    (value) =>
                        ({
                            createdAt: value.project?.createdAt,
                            description: value.project?.description,
                            updatedAt: value.project?.updatedAt,
                            name: value.project?.name,
                            uuid: value.project?.uuid,
                            rights: value.rights,
                            autoConvert: value.project?.autoConvert ?? false,
                        }) as ProjectWithAccessRightsDto,
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
                    creator: accessGroup.creator
                        ? userEntityToDto(accessGroup.creator)
                        : null,
                    memberships:
                        accessGroup.memberships?.map(
                            groupMembershipEntityToDto,
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
            data: access.map((element) => projectAccessEntityToDto(element)),
            count,
            take: count,
            skip: 0,
        };
    }

    private async uncheckedProjectAccessTransactionalUpdate(
        transaction: EntityManager,
        projectUuid: string,
        newProjectAccess: ProjectAccessDto[],
    ): Promise<void> {
        // remove all old access rights
        await transaction.delete(ProjectAccess, {
            project: { uuid: projectUuid },
        });

        // set the new access rights
        const accessUpdates = newProjectAccess.map((access) =>
            transaction.upsert(
                ProjectAccess,
                {
                    project: { uuid: projectUuid },
                    accessGroup: { uuid: access.uuid },
                    rights: access.rights,
                },
                ['project.uuid', 'accessGroup.uuid'],
            ),
        );

        // wait for all updates to finish
        await Promise.all(accessUpdates);
    }

    /**
     * PRE-CONDITIONS for updating project access rights:
     *
     *  - the current user must have at least write rights
     *  - the current user must have at least the same rights
     *    as the highest rights he has modified
     *
     * @param transaction
     * @param projectUuid
     * @param newProjectAccess
     * @param userId
     * @private
     *
     * @throws ConflictException if the pre-conditions are not met
     *
     */
    private async checkProjectAccessModificationPreConditions(
        transaction: EntityManager,
        projectUuid: string,
        newProjectAccess: ProjectAccessDto[],
        userId: string,
    ): Promise<void> {
        // check if the current user has at least write rights
        const userAccess = await transaction.find(ProjectAccess, {
            where: {
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
                project: { uuid: projectUuid },
                accessGroup: { memberships: { user: { uuid: userId } } },
            },
        });

        if (userAccess.length === 0) {
            throw new ConflictException(
                'User does not have write rights for the project',
            );
        }

        // the current user must have at least the same rights
        // as the highest rights he has modified
        const currentAccess = await transaction.find(ProjectAccess, {
            where: {
                project: { uuid: projectUuid },
            },
            relations: ['accessGroup'],
        });

        // filter out the access rights that have not been modified
        const accessRightsChanges = newProjectAccess.filter((access) => {
            return !currentAccess.some(
                (projectAccess) =>
                    projectAccess.accessGroup?.uuid === access.uuid &&
                    projectAccess.rights === access.rights,
            );
        });

        const maxRightsInChanges = Math.max(
            ...accessRightsChanges.map((access) => access.rights),
        );

        const maxRightsOfUser = Math.max(
            ...userAccess.map((access) => access.rights),
        );

        if (maxRightsOfUser < maxRightsInChanges) {
            throw new ConflictException(
                'User cannot grant higher rights than he has himself',
            );
        }
    }

    /**
     * check POST-CONDITIONS for updating project access rights:
     *
     *  - there must be at least one group with delete rights
     *
     * @param transaction
     * @param projectUuid
     * @private
     *
     * @throws ConflictException if the post-conditions are not met
     *
     */
    private async checkProjectAccessModificationPostConditions(
        transaction: EntityManager,
        projectUuid: string,
    ): Promise<void> {
        // check if there is at least one group with delete rights
        const deleteAccess = await transaction.find(ProjectAccess, {
            where: {
                rights: AccessGroupRights.DELETE,
                project: { uuid: projectUuid },
            },
        });

        if (deleteAccess.length === 0) {
            throw new ConflictException(
                'There must be at least one group with delete rights',
            );
        }
    }

    /**
     * Update the access rights for a project
     *
     * This method is a transactional method that updates the access rights for a project.
     * This function assumes that you pass a full newProjectAccess object, i.e. all access rights
     * not passed in the newProjectAccess object will be removed.
     *
     * @param projectUuid
     * @param newProjectAccess
     * @param authHeader
     */
    async updateProjectAccess(
        projectUuid: string,
        newProjectAccess: ProjectAccessDto[],
        authHeader: AuthHeader,
    ): Promise<ProjectAccessListDto> {
        await this.entityManager.transaction(
            async (transactionalEntityManager): Promise<void> => {
                await this.checkProjectAccessModificationPreConditions(
                    transactionalEntityManager,
                    projectUuid,
                    newProjectAccess,
                    authHeader.user.uuid,
                );

                await this.uncheckedProjectAccessTransactionalUpdate(
                    transactionalEntityManager,
                    projectUuid,
                    newProjectAccess,
                );

                await this.checkProjectAccessModificationPostConditions(
                    transactionalEntityManager,
                    projectUuid,
                );
            },
        );

        return await this.getProjectAccesses(projectUuid);
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
        return groupMembershipEntityToDto(savedMembership);
    }
}
