import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Account from '@common/entities/auth/account.entity';
import GroupMembership from '@common/entities/auth/group-membership.entity';
import User from '@common/entities/user/user.entity';
import {
    AccessGroupType,
    CookieNames,
    Providers,
    UserRole,
} from '@common/frontend_shared/enum';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtPayload } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import logger from '../logger';
import { AuthFlowException } from '../routing/filters/auth-flow-exception';
import { AccessGroupConfig } from '../types/access-group-config';

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly config: AccessGroupConfig;

    constructor(
        private jwtService: JwtService,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(GroupMembership)
        private groupMembershipRepository: Repository<GroupMembership>,
        private configService: ConfigService,
    ) {
        const config = this.configService.get('accessConfig');
        if (config === undefined) throw new Error('Access config not found');
        this.config = config;
    }

    async onModuleInit(): Promise<void> {
        await createAccessGroups(this.accessGroupRepository, this.config);
    }

    async validateAndCreateUserByGoogle(profile: any): Promise<User> {
        const { id, emails, displayName, photos } = profile;
        const email = emails[0].value;

        const account = await this.accountRepository.findOne({
            where: { oauthID: id, provider: Providers.GOOGLE },
            relations: ['user'],
        });

        if (account !== null && account.user === undefined) {
            logger.error('Account exists but has no linked user!');
            throw new AuthFlowException(
                'Account exists but has no linked user!',
            );
        }

        if (account?.user !== undefined) {
            return account.user;
        }

        return this.create(
            id,
            Providers.GOOGLE,
            email,
            displayName,
            photos[0].value,
        );
    }

    login(user: User) {
        const payload: JwtPayload = {
            uuid: user.uuid,
        };
        return {
            [CookieNames.AUTH_TOKEN]: this.jwtService.sign(payload, {
                expiresIn: '30m',
            }),
            [CookieNames.REFRESH_TOKEN]: this.jwtService.sign(payload, {
                expiresIn: '7d',
            }),
        };
    }

    /**
     * Create a new account and user with the given information.
     *
     * If the user already exists, but has no linked account, the account will be linked to the existing user.
     * If the user exists and has a linked account, this method throws an error.
     *
     * @param oauthID The ID provided by the OAuth provider
     * @param provider The OAuth provider (e.g. 'google')
     * @param email The email address of the user
     * @param username The name of the user
     * @param picture The URL of the user's profile picture
     */
    async create(
        oauthID: string,
        provider: Providers,
        email: string,
        username: string,
        picture: string,
    ) {
        return createNewUser(
            this.config,
            this.userRepository,
            this.accountRepository,
            this.accessGroupRepository,
            this.groupMembershipRepository,
            {
                oauthID,
                provider,
                email,
                username,
                picture,
            },
        );
    }
}

/**
 * Create access groups from the access group config.
 *
 * @param accessGroupRepository
 * @param config
 */
export const createAccessGroups = async (
    accessGroupRepository: Repository<AccessGroup>,
    config: AccessGroupConfig,
) => {
    // Read access_config/*.json and create access groups
    await Promise.all(
        config.access_groups.map(async (group) => {
            const databaseGroup = await accessGroupRepository.findOne({
                where: { uuid: group.uuid },
            });
            if (!databaseGroup) {
                const newGroup = accessGroupRepository.create({
                    name: group.name,
                    uuid: group.uuid,
                    type: AccessGroupType.AFFILIATION,
                    creator: {},
                });
                return accessGroupRepository.save(newGroup);
            }
        }),
    );
};

/**
 * Create a primary access group for the user.
 *
 * @param user
 * @param accessGroupRepository
 */
async function createPrimaryGroup(
    user: User,
    accessGroupRepository: Repository<AccessGroup>,
) {
    logger.debug(`Add user ${user.uuid} to primary access group`);

    let primaryGroupName = user.name;

    const exists = await accessGroupRepository.exists({
        where: { name: primaryGroupName },
    });

    if (exists) {
        const randomSuffix = Math.random().toString(36).slice(7);
        primaryGroupName = `${user.name} ${randomSuffix}`;
        logger.debug(
            `Primary group name already exists, using ${primaryGroupName}`,
        );
    }

    const primaryGroup = accessGroupRepository.create({
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
    await accessGroupRepository.save(primaryGroup);
}

/**
 * Add user to affiliation groups based on their email address.
 *
 * @param config
 * @param user
 * @param accessGroupRepository
 * @param groupMembershipRepository
 */
async function addToAffiliationGroups(
    config: AccessGroupConfig,
    user: User,
    accessGroupRepository: Repository<AccessGroup>,
    groupMembershipRepository: Repository<GroupMembership>,
) {
    await Promise.all(
        config.emails.map((_config) => {
            if (user.email?.endsWith(_config.email)) {
                return Promise.all(
                    _config.access_groups.map(async (uuid) => {
                        const group = await accessGroupRepository.findOneOrFail(
                            {
                                where: { uuid },
                            },
                        );
                        const affiliationGroup =
                            groupMembershipRepository.create({
                                user: { uuid: user.uuid },
                                accessGroup: { uuid: group.uuid },
                            });
                        return groupMembershipRepository.save(affiliationGroup);
                    }),
                );
            }
        }),
    );
}

export const createNewUser = async (
    config: AccessGroupConfig,
    userRepository: Repository<User>,
    accountRepository: Repository<Account>,
    accessGroupRepository: Repository<AccessGroup>,
    groupMembershipRepository: Repository<GroupMembership>,
    options: {
        oauthID: string;
        provider: Providers;
        email: string;
        username: string;
        picture: string;
    },
): Promise<User> => {
    const existingUser = await userRepository.findOne({
        where: { email: options.email },
        relations: ['account'],
    });

    // assert that we don't have a user with the same email but a different provider
    if (!!existingUser && existingUser.account) {
        throw new AuthFlowException(
            'User already exists and has a linked account!',
        );
    }

    const account: Account = accountRepository.create({
        oauthID: options.oauthID,
        provider: options.provider,
    });

    // if the user exists but has no linked account
    if (!!existingUser && !existingUser.account) {
        logger.info(
            `Linking account ${account.uuid} to existing user ${existingUser.uuid}`,
        );
        account.user = existingUser;
        return accountRepository.save(account).then(() => existingUser);
    }

    /////////////////////////////////////////////////////////
    // Create New User and Link Account
    /////////////////////////////////////////////////////////

    logger.debug(`Creating new user with email ${options.email}`);

    let user: User = userRepository.create({
        email: options.email,
        name: options.username,
        role: UserRole.USER,
        avatarUrl: options.picture || '',
    });

    user.account = await accountRepository.save(account);
    user = await userRepository.save(user);
    user = await userRepository.findOneOrFail({
        where: { uuid: user.uuid },
        relations: ['memberships'],
        select: ['uuid', 'name', 'email', 'role', 'avatarUrl'],
    });

    /////////////////////////////////////////////////////////
    // Create and Link Access Groups
    /////////////////////////////////////////////////////////

    await createPrimaryGroup(user, accessGroupRepository);

    await addToAffiliationGroups(
        config,
        user,
        accessGroupRepository,
        groupMembershipRepository,
    );

    return await userRepository.findOneOrFail({
        where: { uuid: user.uuid },
        relations: ['memberships'],
        select: ['uuid', 'name', 'email', 'role', 'avatarUrl'],
    });
};
