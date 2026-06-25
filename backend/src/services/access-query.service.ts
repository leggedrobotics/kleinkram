import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import {
    groupMembershipEntityToDto,
    projectAccessEntityToDto,
    userEntityToDto,
} from '@/serialization';
import {
    AccessGroupAuditLogsDto,
    AccessGroupDto,
    AccessGroupsDto,
    ProjectAccessListDto,
    ProjectWithAccessRightsDto,
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
    AccessGroupConfig,
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@kleinkram/shared';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import logger from '../logger';
import { UserService } from './user.service';

@Injectable()
export class AccessQueryService {
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
        private readonly configService: ConfigService,
        private readonly accessGroupAuditService: AccessGroupAuditService,
        private readonly userService: UserService,
    ) {}

    async getAccessGroup(
        uuid: string,
        userUuid: string,
    ): Promise<AccessGroupDto> {
        const dbuser = await this.userRepository.findOneOrFail({
            where: { uuid: userUuid },
        });

        if (dbuser.role !== UserRole.ADMIN) {
            const isMember =
                (await this.groupMembershipRepository
                    .createQueryBuilder('groupMembership')
                    .leftJoin('groupMembership.user', 'user')
                    .leftJoin('groupMembership.accessGroup', 'accessGroup')
                    .where('accessGroup.uuid = :uuid', { uuid })
                    .andWhere('user.uuid = :userUuid', { userUuid })
                    .getCount()) > 0;

            if (!isMember) {
                const sharedProjectsCount = await this.projectAccessRepository
                    .createQueryBuilder('projectAccess')
                    .leftJoin('projectAccess.accessGroup', 'accessGroup')
                    .leftJoin('projectAccess.project', 'project')
                    .leftJoin('project.project_accesses', 'allProjectAccesses')
                    .leftJoin(
                        'allProjectAccesses.accessGroup',
                        'userAccessGroup',
                    )
                    .leftJoin('userAccessGroup.memberships', 'memberships')
                    .leftJoin('memberships.user', 'user')
                    .where('accessGroup.uuid = :uuid', { uuid })
                    .andWhere('user.uuid = :userUuid', { userUuid })
                    .getCount();

                if (sharedProjectsCount === 0) {
                    throw new ForbiddenException(
                        'Access denied to this access group',
                    );
                }
            }
        }

        // check if the user can edit the access group (memberships[].canEditGroup)
        const includeEmail =
            (await this.groupMembershipRepository
                .createQueryBuilder('groupMembership')
                .leftJoinAndSelect('groupMembership.user', 'user')
                .leftJoinAndSelect('groupMembership.accessGroup', 'accessGroup')
                .where('accessGroup.uuid = :uuid', { uuid })
                .andWhere('groupMembership.user.uuid = :userUuid', {
                    userUuid,
                })
                .andWhere('groupMembership.canEditGroup = true')
                .getCount()) > 0;

        let accessGroupQuery = this.accessGroupRepository
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
            .where('accessGroup.uuid = :uuid', { uuid });

        // we need to explicitly select the email field
        if (includeEmail)
            accessGroupQuery = accessGroupQuery.addSelect('user.email');

        const rawAccessGroup = await accessGroupQuery.getOneOrFail();

        return {
            createdAt: rawAccessGroup.createdAt,
            creator: rawAccessGroup.creator
                ? userEntityToDto(rawAccessGroup.creator)
                : null,
            hidden: rawAccessGroup.hidden,
            memberships:
                rawAccessGroup.memberships?.map((membership) =>
                    groupMembershipEntityToDto(membership, includeEmail),
                ) ?? [],
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
            emailPattern:
                rawAccessGroup.type === AccessGroupType.AFFILIATION
                    ? this.configService
                          .getOrThrow<AccessGroupConfig>('accessConfig')
                          .emails.find((emailConfig) =>
                              emailConfig.access_groups.includes(
                                  rawAccessGroup.uuid,
                              ),
                          )?.email
                    : undefined,
        };
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
                // eslint-disable-next-line @typescript-eslint/naming-convention
                user_uuid: auth.user.uuid,
            })
            .getExists();
    }

    async searchAccessGroup(
        search: string,
        type: AccessGroupType | undefined,
        skip: number,
        take: number,
    ): Promise<AccessGroupsDto> {
        // we only list the access groups that are not hidden
        const where: FindOptionsWhere<AccessGroupEntity> = {
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
            (accessGroup: AccessGroupEntity): AccessGroupDto => {
                return {
                    creator: accessGroup.creator
                        ? userEntityToDto(accessGroup.creator)
                        : null,
                    memberships:
                        accessGroup.memberships?.map((membership) =>
                            groupMembershipEntityToDto(membership),
                        ) ?? [],
                    createdAt: accessGroup.createdAt,
                    updatedAt: accessGroup.updatedAt,
                    uuid: accessGroup.uuid,
                    name: accessGroup.name,
                    type: accessGroup.type,
                    hidden: accessGroup.hidden,
                    projectAccesses: [],
                    emailPattern:
                        accessGroup.type === AccessGroupType.AFFILIATION
                            ? this.configService
                                  .getOrThrow<AccessGroupConfig>('accessConfig')
                                  .emails.find((emailConfig) =>
                                      emailConfig.access_groups.includes(
                                          accessGroup.uuid,
                                      ),
                                  )?.email
                            : undefined,
                };
            },
        );

        return { data, count, skip, take };
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

    async getAuditLogs(uuid: string): Promise<AccessGroupAuditLogsDto> {
        const [logs, count] =
            await this.accessGroupAuditService.getLogsForGroup(uuid);

        // Extract all unique UUIDs that need resolving
        const uuidsToResolve = new Set<string>();
        for (const log of logs) {
            const details = log.details;
            if (details.userUuid && !details.userName) {
                uuidsToResolve.add(details.userUuid as string);
            }
            if (Array.isArray(details.userUuids)) {
                for (const id of details.userUuids as string[]) {
                    uuidsToResolve.add(id);
                }
            }
        }

        const resolvedUsers = await this.userService.resolveUsers([
            ...uuidsToResolve,
        ]);

        return {
            data: logs.map((log) => {
                const details = { ...log.details };
                if (details.userUuid && !details.userName) {
                    details.userName =
                        resolvedUsers[details.userUuid as string] ??
                        details.userUuid;
                }
                if (Array.isArray(details.userUuids)) {
                    details.affectedUsers = (details.userUuids as string[]).map(
                        (id) => ({
                            uuid: id,
                            name: resolvedUsers[id] ?? id,
                        }),
                    );
                    delete details.userUuids;
                }

                return {
                    uuid: log.uuid,
                    createdAt: log.createdAt,
                    type: log.type,
                    details,
                    actor: log.actor ? userEntityToDto(log.actor) : undefined,
                };
            }),
            count,
        };
    }
}
