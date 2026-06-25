import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import {
    groupMembershipEntityToDto,
    projectEntityToDto,
} from '@/serialization';
import {
    GroupMembershipDto,
    ProjectAccessDto,
    ProjectAccessListDto,
    ProjectDto,
} from '@kleinkram/api-dto';
import {
    AccessGroupAuditService,
    AccessGroupEntity,
} from '@kleinkram/backend-common';
import { GroupMembershipEntity } from '@kleinkram/backend-common/entities/auth/group-membership.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import {
    AccessGroupEventType,
    AccessGroupRights,
    AccessGroupType,
} from '@kleinkram/shared';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, MoreThanOrEqual, Not, Repository } from 'typeorm';
import logger from '../logger';
import { AccessQueryService } from './access-query.service';

@Injectable()
export class AccessModificationService {
    constructor(
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        @InjectRepository(AccessGroupEntity)
        private accessGroupRepository: Repository<AccessGroupEntity>,
        @InjectRepository(GroupMembershipEntity)
        private groupMembershipRepository: Repository<GroupMembershipEntity>,
        @InjectRepository(ProjectEntity)
        private projectRepository: Repository<ProjectEntity>,
        @InjectRepository(ProjectAccessEntity)
        private projectAccessRepository: Repository<ProjectAccessEntity>,
        private readonly entityManager: EntityManager,
        private readonly accessGroupAuditService: AccessGroupAuditService,
        private readonly accessQueryService: AccessQueryService,
    ) {}

    async createAccessGroup(
        name: string,
        auth: AuthHeader,
    ): Promise<AccessGroupEntity> {
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

        const savedGroup = await this.accessGroupRepository.save(newGroup);

        this.accessGroupAuditService
            .log(
                savedGroup.uuid,
                AccessGroupEventType.CREATE_GROUP,
                { name },
                auth.user,
            )
            .catch((error: unknown) =>
                logger.error(`Audit log failed: ${String(error)}`),
            );

        return savedGroup;
    }

    async addUserToProject(
        projectUUID: string,
        userUUID: string,
        rights: AccessGroupRights,
        auth: AuthHeader,
    ): Promise<ProjectEntity> {
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

        const canUpdate = await this.accessQueryService.hasProjectRights(
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

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
        canEditGroup = false,
        expireDate?: Date | 'never',
        auth?: AuthHeader,
    ): Promise<AccessGroupEntity> {
        const result = await this.entityManager.transaction(
            async (transactionalEntityManager) => {
                const accessGroup =
                    await transactionalEntityManager.findOneOrFail(
                        AccessGroupEntity,
                        {
                            where: { uuid: accessGroupUUID },
                            relations: ['memberships'],
                        },
                    );
                const user = await transactionalEntityManager.findOneOrFail(
                    UserEntity,
                    {
                        where: { uuid: userUUID },
                    },
                );

                // @ts-ignore
                const agu = transactionalEntityManager.create(
                    GroupMembershipEntity,
                    {
                        expirationDate:
                            expireDate === 'never' ? undefined : expireDate,
                        canEditGroup,
                    },
                );
                await transactionalEntityManager.save(agu);
                await transactionalEntityManager
                    .createQueryBuilder()
                    .relation(AccessGroupEntity, 'memberships')
                    .of(accessGroup)
                    .add(agu);
                await transactionalEntityManager
                    .createQueryBuilder()
                    .relation(UserEntity, 'memberships')
                    .of(user)
                    .add(agu);
                return await transactionalEntityManager.findOneOrFail(
                    AccessGroupEntity,
                    {
                        where: { uuid: accessGroupUUID },
                        relations: ['memberships', 'memberships.user'],
                    },
                );
            },
        );

        this.accessGroupAuditService
            .log(
                accessGroupUUID,
                AccessGroupEventType.ADD_USER,
                {
                    userUuid: userUUID,
                    userName:
                        result.memberships?.find(
                            (m) => m.user?.uuid === userUUID,
                        )?.user?.name ?? 'Unknown',
                    canEditGroup,
                    expireDate,
                },
                auth?.user as unknown as UserEntity,
            )
            .catch((error: unknown) =>
                logger.error(`Audit log failed: ${String(error)}`),
            );

        return result;
    }

    async removeUsersFromAccessGroup(
        accessGroupUUID: string,
        userUuids: string[],
        auth?: AuthHeader,
    ): Promise<AccessGroupEntity> {
        if (userUuids.length === 0) {
            return this.accessGroupRepository.findOneOrFail({
                where: { uuid: accessGroupUUID },
                relations: ['memberships', 'memberships.user'],
            });
        }
        const result = await this.entityManager.transaction(
            async (transactionalEntityManager) => {
                const usersWithEditRights =
                    await transactionalEntityManager.count(
                        GroupMembershipEntity,
                        {
                            where: {
                                accessGroup: { uuid: accessGroupUUID },
                                user: { uuid: Not(In(userUuids)) },
                                canEditGroup: true,
                            },
                        },
                    );

                if (usersWithEditRights === 0) {
                    throw new ConflictException(
                        'Cannot remove the last user with edit rights',
                    );
                }

                await transactionalEntityManager.delete(GroupMembershipEntity, {
                    accessGroup: { uuid: accessGroupUUID },
                    user: { uuid: In(userUuids) },
                });

                return transactionalEntityManager.findOneOrFail(
                    AccessGroupEntity,
                    {
                        where: { uuid: accessGroupUUID },
                        relations: ['memberships', 'memberships.user'],
                    },
                );
            },
        );

        const removedUsers = await this.userRepository.find({
            where: { uuid: In(userUuids) },
            select: ['uuid', 'name'],
        });

        this.accessGroupAuditService
            .log(
                accessGroupUUID,
                AccessGroupEventType.REMOVE_USER,
                {
                    userUuids,
                    affectedUsers: removedUsers.map((u) => ({
                        uuid: u.uuid,
                        name: u.name,
                    })),
                },
                auth?.user as unknown as UserEntity,
            )
            .catch((error: unknown) =>
                logger.error(`Audit log failed: ${String(error)}`),
            );

        return result;
    }

    async addAccessGroupToProject(
        projectUUID: string,
        accessGroupUUID: string,
        rights: AccessGroupRights,
        auth: AuthHeader,
    ): Promise<ProjectDto> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: ['project_accesses', 'project_accesses.accessGroup'],
        });
        const accessGroup = await this.accessGroupRepository.findOneOrFail({
            where: { uuid: accessGroupUUID },
            relations: ['memberships', 'memberships.user'],
        });

        if (rights === AccessGroupRights.DELETE) {
            const canDelete = await this.accessQueryService.hasProjectRights(
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
                return projectEntityToDto(project);
            }
            existingAccess.rights = rights;
            await this.projectAccessRepository.save(existingAccess);
            const updatedProject = await this.projectRepository.findOneOrFail({
                where: { uuid: projectUUID },
            });
            this.accessGroupAuditService
                .log(
                    accessGroupUUID,
                    AccessGroupEventType.UPDATE_PROJECT_ACCESS,
                    {
                        projectUuid: projectUUID,
                        projectName: project.name,
                        rights,
                    },
                    auth.user,
                )
                .catch((error: unknown) =>
                    logger.error(`Audit log failed: ${String(error)}`),
                );
            return projectEntityToDto(updatedProject);
        }

        const projectAccess = this.projectAccessRepository.create({
            rights: rights,
            accessGroup: accessGroup,
            project: project,
        });
        await this.projectAccessRepository.save(projectAccess);
        const fullProject = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: ['project_accesses', 'project_accesses.accessGroup'],
        });
        this.accessGroupAuditService
            .log(
                accessGroupUUID,
                AccessGroupEventType.ADD_PROJECT,
                { projectUuid: projectUUID, projectName: project.name, rights },

                auth.user,
            )
            .catch((error: unknown) =>
                logger.error(`Audit log failed: ${String(error)}`),
            );
        return projectEntityToDto(fullProject);
    }

    async removeAccessGroupFromProject(
        projectUUID: string,
        accessGroupUUID: string,
        auth: AuthHeader,
    ) {
        const canDelete = await this.accessQueryService.hasProjectRights(
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
        this.accessGroupAuditService
            .log(
                accessGroupUUID,
                AccessGroupEventType.REMOVE_PROJECT,
                {
                    projectUuid: projectUUID,
                    projectName: projectAccess[0]?.project?.name ?? 'Unknown',
                },

                auth.user,
            )
            .catch((error: unknown) =>
                logger.error(`Audit log failed: ${String(error)}`),
            );
    }

    async deleteAccessGroup(uuid: string): Promise<void> {
        const accessGroup = await this.accessGroupRepository.findOneOrFail({
            where: { uuid },
        });

        await this.accessGroupRepository.remove(accessGroup);
        return;
    }

    private async uncheckedProjectAccessTransactionalUpdate(
        transaction: EntityManager,
        projectUuid: string,
        newProjectAccess: ProjectAccessDto[],
    ): Promise<void> {
        // remove all old access rights
        await transaction.delete(ProjectAccessEntity, {
            project: { uuid: projectUuid },
        });

        // set the new access rights
        const accessUpdates = newProjectAccess.map((access) =>
            transaction.upsert(
                ProjectAccessEntity,
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

    private async checkProjectAccessModificationPreConditions(
        transaction: EntityManager,
        projectUuid: string,
        newProjectAccess: ProjectAccessDto[],
        userId: string,
    ): Promise<void> {
        // check if the current user has at least write rights
        const userAccess = await transaction.find(ProjectAccessEntity, {
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
        const currentAccess = await transaction.find(ProjectAccessEntity, {
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

    private async checkProjectAccessModificationPostConditions(
        transaction: EntityManager,
        projectUuid: string,
    ): Promise<void> {
        // check if there is at least one group with delete rights
        const deleteAccess = await transaction.find(ProjectAccessEntity, {
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

        for (const access of newProjectAccess) {
            this.accessGroupAuditService
                .log(
                    access.uuid,
                    AccessGroupEventType.UPDATE_PROJECT_ACCESS,
                    { projectUuid: projectUuid, rights: access.rights },

                    authHeader.user,
                )
                .catch((error: unknown) =>
                    logger.error(`Audit log failed: ${String(error)}`),
                );
        }

        return await this.accessQueryService.getProjectAccesses(projectUuid);
    }

    async setExpireDate(
        uuid: string,
        userUuid: string,
        expireDate: Date | 'never',
        auth?: AuthHeader,
    ): Promise<GroupMembershipDto> {
        const agu = await this.groupMembershipRepository.findOneOrFail({
            where: {
                accessGroup: { uuid },
                user: { uuid: userUuid },
            },
        });
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

        this.accessGroupAuditService
            .log(
                uuid,
                AccessGroupEventType.UPDATE_EXPIRE_DATE,
                {
                    userUuid,
                    userName: savedMembership.user?.name ?? 'Unknown',
                    expireDate,
                },
                auth?.user as unknown as UserEntity,
            )
            .catch((error: unknown) =>
                logger.error(`Audit log failed: ${String(error)}`),
            );

        return groupMembershipEntityToDto(savedMembership);
    }

    async setCanEditGroup(
        uuid: string,
        userUuid: string,
        canEditGroup: boolean,
        auth?: AuthHeader,
    ): Promise<GroupMembershipDto> {
        const agu = await this.groupMembershipRepository.findOneOrFail({
            where: {
                accessGroup: { uuid },
                user: { uuid: userUuid },
            },
        });

        if (!canEditGroup) {
            const editorsCount = await this.groupMembershipRepository.count({
                where: {
                    accessGroup: { uuid },
                    canEditGroup: true,
                },
            });
            if (editorsCount <= 1) {
                throw new ConflictException(
                    'Cannot demote the last user with edit rights',
                );
            }
        }

        agu.canEditGroup = canEditGroup;
        const { uuid: membershipUuid } =
            await this.groupMembershipRepository.save(agu);

        const savedMembership =
            await this.groupMembershipRepository.findOneOrFail({
                where: { uuid: membershipUuid },
                relations: ['user'],
            });

        this.accessGroupAuditService
            .log(
                uuid,
                canEditGroup
                    ? AccessGroupEventType.PROMOTE_USER
                    : AccessGroupEventType.DEMOTE_USER,
                {
                    userUuid,
                    userName: savedMembership.user?.name ?? 'Unknown',
                    canEditGroup,
                },
                auth?.user as unknown as UserEntity,
            )
            .catch((error: unknown) =>
                logger.error(`Audit log failed: ${String(error)}`),
            );

        return groupMembershipEntityToDto(savedMembership);
    }
}
