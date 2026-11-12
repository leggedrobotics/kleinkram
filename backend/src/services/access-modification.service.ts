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
    assertNotPublicAccessGroup,
    assertValidPublicAccessRights,
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
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: {
                project_accesses: {
                    accessGroup: true,
                },
            },
        });
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

        await this.assertCanChangeProjectRights(
            projectUUID,
            auth,
            rights,
            existingAccess?.rights,
        );

        if (existingAccess) {
            existingAccess.rights = rights;
            await this.projectAccessRepository.save(existingAccess);
            return this.projectRepository.findOneOrFail({
                where: { uuid: projectUUID },
                relations: {
                    project_accesses: {
                        accessGroup: true,
                    },
                },
            });
        }

        const projectAccess = this.projectAccessRepository.create({
            rights: rights,
            accessGroup: personalAccessGroup,
            project: project,
        });
        await this.projectAccessRepository.save(projectAccess);
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
        assertValidPublicAccessRights(accessGroupUUID, rights);

        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
            relations: {
                project_accesses: {
                    accessGroup: true,
                },
            },
        });
        const accessGroup = await this.accessGroupRepository.findOneOrFail({
            where: { uuid: accessGroupUUID },
            relations: {
                memberships: {
                    user: true,
                },
            },
        });

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

        // this endpoint never lowers rights: an existing entry with higher
        // rights stays as it is, so only the new rights need to be covered
        await this.assertCanChangeProjectRights(projectUUID, auth, rights);

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
                    { projectUuid: projectUUID, rights },
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
            relations: {
                project_accesses: {
                    accessGroup: true,
                },
            },
        });
        this.accessGroupAuditService
            .log(
                accessGroupUUID,
                AccessGroupEventType.ADD_PROJECT,
                { projectUuid: projectUUID, rights },
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
     * Rejects storing rights above DELETE on a project. `_ADMIN` is a valid
     * enum value, and every check compares with `>=`, so it would act as
     * DELETE while getting past checks that test for DELETE exactly.
     */
    private assertGrantableProjectRights(rights: AccessGroupRights): void {
        if (rights > AccessGroupRights.DELETE) {
            throw new ConflictException(
                'Project access rights cannot be higher than DELETE',
            );
        }
    }

    /**
     * Rejects a change to a project access entry unless the caller holds at
     * least the rights the entry has before (`existingRights`) and after
     * (`newRights`) the change. This covers granting, raising, lowering and
     * removing rights: you can never touch an entry above your own level.
     *
     * The caller's rights come from `hasProjectRights`, which ignores expired
     * memberships and lets global admins through.
     */
    private async assertCanChangeProjectRights(
        projectUuid: string,
        auth: AuthHeader,
        newRights: AccessGroupRights,
        existingRights?: AccessGroupRights,
    ): Promise<void> {
        this.assertGrantableProjectRights(newRights);
        await this.assertHasProjectRights(
            projectUuid,
            auth,
            Math.max(
                newRights,
                existingRights ?? AccessGroupRights.READ,
            ) as AccessGroupRights,
        );
    }

    private async assertHasProjectRights(
        projectUuid: string,
        auth: AuthHeader,
        requiredRights: AccessGroupRights,
    ): Promise<void> {
        const hasRights = await this.accessQueryService.hasProjectRights(
            projectUuid,
            auth,
            requiredRights,
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
                currentRights.set(access.accessGroup.uuid, access.rights);
        }
        const newRights = new Map<string, AccessGroupRights>();
        for (const access of newProjectAccess) {
            // the rows are upserted in parallel, so with a duplicate either
            // value could end up stored, whatever was checked here
            if (newRights.has(access.uuid)) {
                throw new ConflictException(
                    'Each access group may only appear once',
                );
            }
            this.assertGrantableProjectRights(access.rights);
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
            requireAtLeast(rights);
            if (before !== undefined) requireAtLeast(before);
        }
        for (const [uuid, rights] of currentRights) {
            if (!newRights.has(uuid)) requireAtLeast(rights);
        }

        // nothing changes: the route guard already requires write rights
        if (requiredRights === undefined) return;

        await this.assertHasProjectRights(projectUuid, auth, requiredRights);
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
        for (const access of newProjectAccess) {
            assertValidPublicAccessRights(access.uuid, access.rights);
        }

        await this.entityManager.transaction(
            async (transactionalEntityManager): Promise<void> => {
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
