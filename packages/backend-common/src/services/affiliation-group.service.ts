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
     * @param _email Override email if user entity email is unset
     */
    async addToAffiliationGroups(
        config: AccessGroupConfig,
        user: UserEntity,
        _email?: string,
    ): Promise<void> {
        const resolvingEmail = _email ?? user.email;

        await Promise.all(
            // eslint-disable-next-line @typescript-eslint/await-thenable
            config.emails.map((_config) => {
                if (resolvingEmail?.endsWith(_config.email)) {
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
