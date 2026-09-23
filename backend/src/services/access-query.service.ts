import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import {
    groupMembershipEntityToDto,
    projectAccessEntityToDto,
    projectAccessesToProjectDtos,
    userEntityToDto,
} from '@/serialization';
import {
    AccessGroupAuditLogsDto,
    AccessGroupDto,
    AccessGroupsDto,
    ProjectAccessListDto,
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
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import logger from '../logger';
import { UserService } from './user.service';

/**
 * Prefer the live name, then a name snapshot stored by older versions
 * ('Unknown' was written when the lookup failed), then the raw UUID.
 */
const pickName = (
    resolved: string | undefined,
    snapshot: unknown,
    fallback: string,
): string =>
    resolved ??
    (typeof snapshot === 'string' && snapshot !== 'Unknown'
        ? snapshot
        : fallback);

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
            projectAccesses: projectAccessesToProjectDtos(
                rawAccessGroup.project_accesses,
            ),
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
                relations: {
                    memberships: {
                        user: true,
                    },

                    project_accesses: {
                        project: true,
                    },

                    creator: true,
                },
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
                    projectAccesses: projectAccessesToProjectDtos(
                        accessGroup.project_accesses,
                    ),
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
                relations: {
                    project: true,

                    accessGroup: {
                        memberships: true,
                    },
                },
            },
        );

        return {
            data: access.map((element) => projectAccessEntityToDto(element)),
            count,
            take: count,
            skip: 0,
        };
    }

    /**
     * Audit log entries only persist UUIDs. Names are resolved at read time so
     * renamed users / projects show up with their current name. Name snapshots
     * written by older versions are only used as fallback (e.g. hard-deleted
     * entities), and the raw UUID as last resort.
     */
    async getAuditLogs(uuid: string): Promise<AccessGroupAuditLogsDto> {
        const [logs, count] =
            await this.accessGroupAuditService.getLogsForGroup(uuid);

        const userUuids = new Set<string>();
        const projectUuids = new Set<string>();
        for (const { details } of logs) {
            if (typeof details.userUuid === 'string') {
                userUuids.add(details.userUuid);
            }
            if (Array.isArray(details.userUuids)) {
                for (const id of details.userUuids as string[]) {
                    userUuids.add(id);
                }
            }
            if (typeof details.projectUuid === 'string') {
                projectUuids.add(details.projectUuid);
            }
        }

        const [userNames, projectNames] = await Promise.all([
            this.userService.resolveUsers([...userUuids]),
            this.resolveProjectNames([...projectUuids]),
        ]);

        return {
            data: logs.map((log) => {
                const details = { ...log.details };
                if (typeof details.userUuid === 'string') {
                    details.userName = pickName(
                        userNames[details.userUuid],
                        details.userName,
                        details.userUuid,
                    );
                }
                if (Array.isArray(details.userUuids)) {
                    const snapshots = new Map<string, unknown>(
                        Array.isArray(details.affectedUsers)
                            ? (
                                  details.affectedUsers as {
                                      uuid: string;
                                      name: unknown;
                                  }[]
                              ).map((u) => [u.uuid, u.name])
                            : [],
                    );
                    details.affectedUsers = (details.userUuids as string[]).map(
                        (id) => ({
                            uuid: id,
                            name: pickName(
                                userNames[id],
                                snapshots.get(id),
                                id,
                            ),
                        }),
                    );
                    delete details.userUuids;
                }
                if (typeof details.projectUuid === 'string') {
                    details.projectName = pickName(
                        projectNames[details.projectUuid],
                        details.projectName,
                        details.projectUuid,
                    );
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

    private async resolveProjectNames(
        uuids: string[],
    ): Promise<Record<string, string>> {
        if (uuids.length === 0) return {};
        // include soft-deleted projects, the audit log outlives them
        const projects = await this.projectRepository.find({
            where: { uuid: In(uuids) },
            select: { uuid: true, name: true },
            withDeleted: true,
        });
        return Object.fromEntries(projects.map((p) => [p.uuid, p.name]));
    }
}
