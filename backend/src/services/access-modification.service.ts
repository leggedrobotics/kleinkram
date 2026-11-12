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
import { EntityManager, In, Not, Repository } from 'typeorm';
import logger from '../logger';
import { AccessQueryService } from './access-query.service';
import { notExpired } from './membership-filters';
import {
    assertGrantableAccessRights,
    assertNotPublicAccessGroup,
    assertValidPublicAccessRights,
    isPublicAccessGroup,
    PUBLIC_ACCESS_MANAGE_RIGHTS,
} from './public-access';

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
        assertGrantableAccessRights(rights);

        const dbuser = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
            relations: {
                memberships: {
                    accessGroup: true,
                },
            },
        });

        if (dbuser.memberships === undefined)
            throw new Error('User has no memberships');

        // take the group out of the membership: project access points to
        // the access group, not to the user's membership in it
        const personalAccessGroup = dbuser.memberships.find(
            (membership) =>
                membership.accessGroup?.type === AccessGroupType.PRIMARY,
        )?.accessGroup;

        if (personalAccessGroup === undefined)
            throw new Error('User has no personal access group');

        await this.entityManager.transaction(async (transaction) => {
            const project = await this.lockProjectForAccessChange(
                transaction,
                projectUUID,
            );

            const existingAccess = await transaction.findOne(
                ProjectAccessEntity,
                {
                    where: {
                        project: { uuid: projectUUID },
                        accessGroup: { uuid: personalAccessGroup.uuid },
                    },
                },
            );

            await this.assertCanChangeProjectRights(
                transaction,
                projectUUID,
                auth,
                personalAccessGroup.uuid,
                rights,
                existingAccess?.rights,
            );

            if (existingAccess) {
                existingAccess.rights = rights;
                await transaction.save(existingAccess);
            } else {
                await transaction.save(
                    transaction.create(ProjectAccessEntity, {
                        rights,
                        accessGroup: personalAccessGroup,
                        project,
                    }),
                );
            }

            // lowering your own entry could leave no one with DELETE
            await this.checkProjectAccessModificationPostConditions(
                transaction,
                projectUUID,
            );
        });

        return this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: {
                project_accesses: {
                    accessGroup: true,
                },
            },
        });
    }

    async addUserToAccessGroup(
        accessGroupUUID: string,
        userUUID: string,
        canEditGroup = false,
        expireDate?: Date | 'never',
        auth?: AuthHeader,
    ): Promise<AccessGroupEntity> {
        assertNotPublicAccessGroup(accessGroupUUID);

        const result = await this.entityManager.transaction(
            async (transactionalEntityManager) => {
                const accessGroup =
                    await transactionalEntityManager.findOneOrFail(
                        AccessGroupEntity,
                        {
                            where: { uuid: accessGroupUUID },
                            relations: {
                                memberships: true,
                            },
                        },
                    );
                const user = await transactionalEntityManager.findOneOrFail(
                    UserEntity,
                    {
                        where: { uuid: userUUID },
                    },
                );

                const existingMembership =
                    await transactionalEntityManager.findOne(
                        GroupMembershipEntity,
                        {
                            where: {
                                accessGroup: { uuid: accessGroupUUID },
                                user: { uuid: userUUID },
                            },
                        },
                    );

                if (existingMembership) {
                    throw new ConflictException(
                        'User is already a member of this access group',
                    );
                }

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
                        relations: {
                            memberships: {
                                user: true,
                            },
                        },
                    },
                );
            },
        );

        this.accessGroupAuditService
            .log(
                accessGroupUUID,
                AccessGroupEventType.ADD_USER,
                { userUuid: userUUID, canEditGroup, expireDate },
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
        assertNotPublicAccessGroup(accessGroupUUID);

        if (userUuids.length === 0) {
            return this.accessGroupRepository.findOneOrFail({
                where: { uuid: accessGroupUUID },
                relations: {
                    memberships: {
                        user: true,
                    },
                },
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
                                expirationDate: notExpired(),
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
                        relations: {
                            memberships: {
                                user: true,
                            },
                        },
                    },
                );
            },
        );

        this.accessGroupAuditService
            .log(
                accessGroupUUID,
                AccessGroupEventType.REMOVE_USER,
                { userUuids },
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
        assertGrantableAccessRights(rights);
        assertValidPublicAccessRights(accessGroupUUID, rights);

        const accessGroup = await this.accessGroupRepository.findOneOrFail({
            where: { uuid: accessGroupUUID },
        });

        const event = await this.entityManager.transaction(
            async (transaction): Promise<AccessGroupEventType | undefined> => {
                const project = await this.lockProjectForAccessChange(
                    transaction,
                    projectUUID,
                );

                const existingAccess = await transaction.findOne(
                    ProjectAccessEntity,
                    {
                        where: {
                            project: { uuid: projectUUID },
                            accessGroup: { uuid: accessGroupUUID },
                        },
                    },
                );

                // this endpoint never lowers rights: an existing entry with
                // higher rights stays as it is, so only the new rights need
                // to be covered
                await this.assertCanChangeProjectRights(
                    transaction,
                    projectUUID,
                    auth,
                    accessGroupUUID,
                    rights,
                );

                if (existingAccess) {
                    if (existingAccess.rights >= rights) return undefined;
                    existingAccess.rights = rights;
                    await transaction.save(existingAccess);
                    return AccessGroupEventType.UPDATE_PROJECT_ACCESS;
                }

                await transaction.save(
                    transaction.create(ProjectAccessEntity, {
                        rights,
                        accessGroup,
                        project,
                    }),
                );
                return AccessGroupEventType.ADD_PROJECT;
            },
        );

        if (event !== undefined) {
            this.accessGroupAuditService
                .log(
                    accessGroup.uuid,
                    event,
                    { projectUuid: projectUUID, rights },
                    auth.user,
                )
                .catch((error: unknown) =>
                    logger.error(`Audit log failed: ${String(error)}`),
                );
        }

        const fullProject = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: {
                project_accesses: {
                    accessGroup: true,
                },
            },
        });
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
                { projectUuid: projectUUID },
                auth.user,
            )
            .catch((error: unknown) =>
                logger.error(`Audit log failed: ${String(error)}`),
            );
    }

    async deleteAccessGroup(uuid: string): Promise<void> {
        assertNotPublicAccessGroup(uuid);

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

    /**
     * Locks the project row until the transaction ends. Every change to a
     * project's access takes this lock first, then reads the current entries
     * and checks rights, so two changes cannot interleave between the check
     * and the write (e.g. an owner raising an entry while a writer's request
     * that saw the old value lowers it again).
     */
    private async lockProjectForAccessChange(
        transaction: EntityManager,
        projectUuid: string,
    ): Promise<ProjectEntity> {
        return transaction.findOneOrFail(ProjectEntity, {
            where: { uuid: projectUuid },
            lock: { mode: 'pessimistic_write' },
        });
    }

    /**
     * The rights a caller needs to change the entry of `accessGroupUuid`
     * between the given rights (before and after the change; `undefined`
     * when the entry does not exist on that side). You can never touch an
     * entry above your own level, and making a project public or restricted
     * again takes `PUBLIC_ACCESS_MANAGE_RIGHTS`.
     */
    private requiredRightsToChange(
        accessGroupUuid: string,
        ...rights: (AccessGroupRights | undefined)[]
    ): AccessGroupRights {
        let required = isPublicAccessGroup(accessGroupUuid)
            ? PUBLIC_ACCESS_MANAGE_RIGHTS
            : AccessGroupRights.READ;
        for (const value of rights) {
            if (value !== undefined && value > required) required = value;
        }
        return required;
    }

    /**
     * Rejects a change to a project access entry unless the caller holds
     * `requiredRightsToChange` for it. This covers granting, raising,
     * lowering and removing rights.
     *
     * The caller's rights come from `hasProjectRights`, which ignores expired
     * memberships and lets global admins through.
     */
    private async assertCanChangeProjectRights(
        transaction: EntityManager,
        projectUuid: string,
        auth: AuthHeader,
        accessGroupUuid: string,
        newRights: AccessGroupRights,
        existingRights?: AccessGroupRights,
    ): Promise<void> {
        assertGrantableAccessRights(newRights);
        await this.assertHasProjectRights(
            transaction,
            projectUuid,
            auth,
            this.requiredRightsToChange(
                accessGroupUuid,
                newRights,
                existingRights,
            ),
        );
    }

    private async assertHasProjectRights(
        transaction: EntityManager,
        projectUuid: string,
        auth: AuthHeader,
        requiredRights: AccessGroupRights,
    ): Promise<void> {
        // on the transaction's connection, see `hasProjectRights`
        const hasRights = await this.accessQueryService.hasProjectRights(
            projectUuid,
            auth,
            requiredRights,
            transaction,
        );
        if (!hasRights) {
            throw new ConflictException(
                'You cannot grant, change or remove project access rights above your own',
            );
        }
    }

    private async checkProjectAccessModificationPreConditions(
        transaction: EntityManager,
        projectUuid: string,
        newProjectAccess: ProjectAccessDto[],
        auth: AuthHeader,
    ): Promise<void> {
        const currentAccess = await transaction.find(ProjectAccessEntity, {
            where: {
                project: { uuid: projectUuid },
            },
            relations: {
                accessGroup: true,
            },
        });

        const currentRights = new Map<string, AccessGroupRights>();
        for (const access of currentAccess) {
            if (access.accessGroup)
                currentRights.set(
                    access.accessGroup.uuid.toLowerCase(),
                    access.rights,
                );
        }
        // `newProjectAccess` is normalized by `updateProjectAccess`
        const newRights = new Map<string, AccessGroupRights>();
        for (const access of newProjectAccess) {
            // the rows are upserted in parallel, so with a duplicate either
            // value could end up stored, whatever was checked here
            if (newRights.has(access.uuid)) {
                throw new ConflictException(
                    'Each access group may only appear once',
                );
            }
            newRights.set(access.uuid, access.rights);
        }

        // every entry that is added, changed or removed (a removed entry is
        // one that is missing from the new list, the update replaces all)
        let requiredRights: AccessGroupRights | undefined;
        const requireAtLeast = (rights: AccessGroupRights): void => {
            if (requiredRights === undefined || rights > requiredRights)
                requiredRights = rights;
        };
        for (const [uuid, rights] of newRights) {
            const before = currentRights.get(uuid);
            if (before === rights) continue;
            requireAtLeast(this.requiredRightsToChange(uuid, rights, before));
        }
        for (const [uuid, rights] of currentRights) {
            if (!newRights.has(uuid))
                requireAtLeast(this.requiredRightsToChange(uuid, rights));
        }

        // nothing changes: the route guard already requires write rights
        if (requiredRights === undefined) return;

        await this.assertHasProjectRights(
            transaction,
            projectUuid,
            auth,
            requiredRights,
        );
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
        // PostgreSQL compares uuids case-insensitively, the checks below
        // compare strings: `abc…` and `ABC…` must count as the same group
        for (const access of newProjectAccess) {
            access.uuid = access.uuid.toLowerCase();
        }

        for (const access of newProjectAccess) {
            assertGrantableAccessRights(access.rights);
            assertValidPublicAccessRights(access.uuid, access.rights);
        }

        await this.entityManager.transaction(
            async (transactionalEntityManager): Promise<void> => {
                await this.lockProjectForAccessChange(
                    transactionalEntityManager,
                    projectUuid,
                );

                await this.checkProjectAccessModificationPreConditions(
                    transactionalEntityManager,
                    projectUuid,
                    newProjectAccess,
                    authHeader,
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
                relations: {
                    user: true,
                },
            });

        this.accessGroupAuditService
            .log(
                uuid,
                AccessGroupEventType.UPDATE_EXPIRE_DATE,
                { userUuid, expireDate },
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
            // count the editors that stay, ignoring expired ones: they can
            // no longer act on the group
            const otherEditors = await this.groupMembershipRepository.count({
                where: {
                    accessGroup: { uuid },
                    user: { uuid: Not(userUuid) },
                    canEditGroup: true,
                    expirationDate: notExpired(),
                },
            });
            if (otherEditors === 0) {
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
                relations: {
                    user: true,
                },
            });

        this.accessGroupAuditService
            .log(
                uuid,
                canEditGroup
                    ? AccessGroupEventType.PROMOTE_USER
                    : AccessGroupEventType.DEMOTE_USER,
                { userUuid, canEditGroup },
                auth?.user as unknown as UserEntity,
            )
            .catch((error: unknown) =>
                logger.error(`Audit log failed: ${String(error)}`),
            );

        return groupMembershipEntityToDto(savedMembership);
    }
}
