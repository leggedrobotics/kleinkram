import { AccessGroupConfig, AccessGroupType } from '@kleinkram/shared';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGroupEntity } from '../entities/auth/access-group.entity';
import { GroupMembershipEntity } from '../entities/auth/group-membership.entity';
import { UserEntity } from '../entities/user/user.entity';

@Injectable()
export class AffiliationGroupService {
    private readonly logger = new Logger(AffiliationGroupService.name);

    constructor(
        @InjectRepository(AccessGroupEntity)
        private accessGroupRepository: Repository<AccessGroupEntity>,
        @InjectRepository(GroupMembershipEntity)
        private groupMembershipRepository: Repository<GroupMembershipEntity>,
    ) {}

    /**
     * Create access groups from the access group config.
     *
     * @param config
     */
    async createAccessGroups(config: AccessGroupConfig): Promise<void> {
        // Read access_config/*.json and create access groups
        await Promise.all(
            config.access_groups.map(async (group) => {
                const databaseGroup = await this.accessGroupRepository.findOne({
                    where: { uuid: group.uuid },
                    withDeleted: true,
                });
                if (!databaseGroup) {
                    const newGroup = this.accessGroupRepository.create({
                        name: group.name,
                        uuid: group.uuid,
                        type: AccessGroupType.AFFILIATION,
                        creator: {},
                    });
                    return this.accessGroupRepository.save(newGroup);
                }
                return;
            }),
        );
    }

    /**
     * Sync affiliation groups and memberships with the access group config.
     * Creates missing groups, updates names, soft-deletes stale groups,
     * and reconciles user memberships based on email patterns.
     *
     * @param config
     * @param userRepository
     */
    async syncAccessGroups(
        config: AccessGroupConfig,
        userRepository: Repository<UserEntity>,
    ): Promise<void> {
        const configUuids = new Set(config.access_groups.map((g) => g.uuid));

        // 1. Upsert groups from config
        await Promise.all(
            config.access_groups.map(async (group) => {
                const existing = await this.accessGroupRepository.findOne({
                    where: { uuid: group.uuid },
                    withDeleted: true,
                });
                if (!existing) {
                    const newGroup = this.accessGroupRepository.create({
                        name: group.name,
                        uuid: group.uuid,
                        type: AccessGroupType.AFFILIATION,
                        creator: {},
                    });
                    return this.accessGroupRepository.save(newGroup);
                }
                const needsUpdate =
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    existing.deletedAt !== null || existing.name !== group.name;
                if (!needsUpdate) return;
                existing.deletedAt = null;
                existing.name = group.name;
                return this.accessGroupRepository.save(existing);
            }),
        );

        // 2. Soft-delete stale affiliation groups not in config
        const allAffiliationGroups = await this.accessGroupRepository.find({
            where: { type: AccessGroupType.AFFILIATION },
        });
        const staleGroups = allAffiliationGroups.filter(
            (g) => !configUuids.has(g.uuid),
        );
        for (const staleGroup of staleGroups) {
            await this.groupMembershipRepository.delete({
                accessGroup: { uuid: staleGroup.uuid },
            });
            await this.accessGroupRepository.softRemove(staleGroup);
        }

        // 3. Re-sync user memberships for affiliation groups
        const users = await userRepository
            .createQueryBuilder('user')
            .addSelect('user.email')
            .leftJoinAndSelect('user.memberships', 'membership')
            .leftJoinAndSelect('membership.accessGroup', 'accessGroup')
            .getMany();

        for (const user of users) {
            if (!user.email) continue;

            // Compute expected affiliation group UUIDs from config
            const expectedUuids = new Set<string>();
            for (const emailConfig of config.emails) {
                if (user.email.endsWith('@' + emailConfig.email)) {
                    for (const uuid of emailConfig.access_groups) {
                        expectedUuids.add(uuid);
                    }
                }
            }

            const currentAffiliationMemberships = (
                user.memberships ?? []
            ).filter(
                (m) =>
                    m.accessGroup?.type === AccessGroupType.AFFILIATION &&
                    configUuids.has(m.accessGroup.uuid),
            );

            // Add missing memberships
            for (const uuid of expectedUuids) {
                const alreadyMember = currentAffiliationMemberships.some(
                    (m) => m.accessGroup?.uuid === uuid,
                );
                if (!alreadyMember) {
                    const membership = this.groupMembershipRepository.create({
                        user: { uuid: user.uuid },
                        accessGroup: { uuid },
                    });
                    await this.groupMembershipRepository.save(membership);
                }
            }

            // Remove memberships that no longer match
            for (const membership of currentAffiliationMemberships) {
                if (
                    membership.accessGroup?.uuid &&
                    !expectedUuids.has(membership.accessGroup.uuid)
                ) {
                    await this.groupMembershipRepository.remove(membership);
                }
            }
        }
    }

    /**
     * Create a primary access group for the user.
     *
     * @param user
     */
    async createPrimaryGroup(user: UserEntity): Promise<void> {
        let primaryGroupName = user.name;

        const exists = await this.accessGroupRepository.exists({
            where: { name: primaryGroupName },
        });

        if (exists) {
            const randomSuffix = Math.random().toString(36).slice(7);
            primaryGroupName = `${user.name} ${randomSuffix}`;
            this.logger.debug(
                `Primary group name already exists, using ${primaryGroupName}`,
            );
        }

        const primaryGroup = this.accessGroupRepository.create({
            name: primaryGroupName,
            type: AccessGroupType.PRIMARY,
            hidden: false,
            memberships: [
                {
                    canEditGroup: false,
                    user: { uuid: user.uuid },
                },
            ],
        });
        await this.accessGroupRepository.save(primaryGroup);
    }

    /**
     * Add user to affiliation groups based on their email address.
     *
     * @param config
     * @param user
     * @param overrideEmail Override email if user entity email is unset
     */
    async addToAffiliationGroups(
        config: AccessGroupConfig,
        user: UserEntity,
        overrideEmail?: string,
    ): Promise<void> {
        const resolvingEmail = overrideEmail ?? user.email;

        if (!resolvingEmail) {
            this.logger.warn(
                `Cannot assign affiliation groups for user ${user.uuid}: no email available`,
            );
            return;
        }

        await Promise.all(
            // eslint-disable-next-line @typescript-eslint/await-thenable
            config.emails.map((_config) => {
                if (resolvingEmail.endsWith('@' + _config.email)) {
                    return Promise.all(
                        _config.access_groups.map(async (uuid) => {
                            const group =
                                await this.accessGroupRepository.findOneOrFail({
                                    where: { uuid },
                                });

                            const existingMembership =
                                await this.groupMembershipRepository.findOne({
                                    where: {
                                        user: { uuid: user.uuid },
                                        accessGroup: { uuid: group.uuid },
                                    },
                                    relations: ['accessGroup', 'user'],
                                });

                            if (!existingMembership) {
                                const affiliationGroup =
                                    this.groupMembershipRepository.create({
                                        user: { uuid: user.uuid },
                                        accessGroup: { uuid: group.uuid },
                                    });
                                return this.groupMembershipRepository.save(
                                    affiliationGroup,
                                );
                            }
                            return;
                        }),
                    );
                }
                return;
            }),
        );
    }
}
