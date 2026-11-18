import { AuthFlowException } from '@/types/auth-flow-exception';
import {
    AffiliationGroupService,
    externalUsersAllowed,
    isEmailAllowedToSignIn,
    isInternalEmail,
} from '@kleinkram/backend-common';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { AccessGroupConfig, Providers, UserRole } from '@kleinkram/shared';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import logger from '../logger';

async function syncAffiliationAndReturn(
    affiliationGroupService: AffiliationGroupService,
    config: AccessGroupConfig,
    user: UserEntity,
    email: unknown,
): Promise<UserEntity> {
    const resolvedEmail = typeof email === 'string' ? email : undefined;
    await affiliationGroupService.addToAffiliationGroups(
        config,
        user,
        resolvedEmail,
    );
    return user;
}

/** An email address as an OAuth provider reports it. */
export interface ProviderEmail {
    value: string;
    /** whether the provider confirmed that the user owns the address */
    verified?: boolean | string;
    primary?: boolean;
}

export const EXTERNAL_LOGIN_REFUSED_MESSAGE =
    'This Kleinkram instance only accepts accounts with a verified email address of an allowed domain. Contact your administrator if you think this is wrong.';

const isVerified = (email: ProviderEmail): boolean =>
    email.verified === true || email.verified === 'true';

/**
 * The email address to use for a login.
 *
 * Without restriction (`allow_external_users` not `false`) this is the
 * primary address, or the first one, as the provider sends it. With the
 * restriction it is a verified address on one of the configured domains,
 * the primary one if it qualifies; `undefined` if there is none.
 *
 * @param config the access group config
 * @param emails the addresses the provider reported
 */
export const selectLoginEmail = (
    config: AccessGroupConfig,
    emails: ProviderEmail[],
): string | undefined => {
    const byPrimary = [
        ...emails.filter((email) => email.primary === true),
        ...emails.filter((email) => email.primary !== true),
    ];
    if (externalUsersAllowed(config)) return byPrimary[0]?.value;
    return byPrimary.find(
        (email) => isVerified(email) && isInternalEmail(config, email.value),
    )?.value;
};

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly config: AccessGroupConfig;

    constructor(
        @InjectRepository(AccountEntity)
        private accountRepository: Repository<AccountEntity>,
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        private affiliationGroupService: AffiliationGroupService,
        private configService: ConfigService,
    ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const config = this.configService.get('accessConfig');
        if (config === undefined) throw new Error('Access config not found');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.config = config;
    }

    async onModuleInit(): Promise<void> {
        await this.affiliationGroupService.syncAccessGroups(
            this.config,
            this.userRepository,
        );
        await this.affiliationGroupService.createPublicAccessGroup();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async validateAndCreateUserByGitHub(profile: any): Promise<UserEntity> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { id, emails, displayName, photos } = profile;
        return this.validateAndCreateUser(Providers.GITHUB, {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            oauthID: id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            emails: emails ?? [],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            username: displayName,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            picture: photos?.[0]?.value ?? '',
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async validateAndCreateUserByFakeOAuth(profile: any): Promise<UserEntity> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { id, email, displayName, photo } = profile;
        return this.validateAndCreateUser(Providers.FakeOAuth, {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            oauthID: id,
            // the fake provider (development and tests only) has one
            // address, which counts as verified
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            emails: email ? [{ value: email, verified: true }] : [],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            username: displayName,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            picture: photo ?? '',
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async validateAndCreateUserByGoogle(profile: any): Promise<UserEntity> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { id, emails, displayName, photos } = profile;
        return this.validateAndCreateUser(Providers.GOOGLE, {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            oauthID: id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            emails: emails ?? [],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            username: displayName,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            picture: photos?.[0]?.value ?? '',
        });
    }

    /**
     * Signs in the user of an OAuth account, creating the user on the first
     * login. With `allow_external_users: false` in the access config, only
     * users with a verified email on one of the configured domains get in.
     */
    private async validateAndCreateUser(
        provider: Providers,
        profile: {
            oauthID: string;
            emails: ProviderEmail[];
            username: string;
            picture: string;
        },
    ): Promise<UserEntity> {
        const account = await this.accountRepository.findOne({
            where: { oauthID: profile.oauthID, provider },
            relations: {
                user: true,
            },
        });

        if (account !== null && account.user === undefined) {
            logger.error('Account exists but has no linked user!');
            throw new AuthFlowException(
                'Account exists but has no linked user!',
            );
        }

        const email = selectLoginEmail(this.config, profile.emails);
        if (email === undefined) {
            if (externalUsersAllowed(this.config)) {
                throw new AuthFlowException(
                    'The login provider did not share an email address.',
                );
            }
            logger.info(
                `Refused ${provider} login of account ${profile.oauthID}: no verified email on an allowed domain`,
            );
            throw new AuthFlowException(EXTERNAL_LOGIN_REFUSED_MESSAGE);
        }

        if (account?.user !== undefined) {
            // the email stored for the user must be allowed as well: it is
            // the one checked when the session is refreshed
            if (!externalUsersAllowed(this.config)) {
                const stored = await this.userRepository.findOne({
                    where: { uuid: account.user.uuid },
                    select: { uuid: true, email: true },
                });
                if (!isInternalEmail(this.config, stored?.email)) {
                    logger.info(
                        `Refused ${provider} login of user ${account.user.uuid}: email not on an allowed domain`,
                    );
                    throw new AuthFlowException(EXTERNAL_LOGIN_REFUSED_MESSAGE);
                }
            }
            return syncAffiliationAndReturn(
                this.affiliationGroupService,
                this.config,
                account.user,
                email,
            );
        }

        return this.create(
            profile.oauthID,
            provider,
            email,
            profile.username,
            profile.picture,
        );
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
    ): Promise<UserEntity> {
        return createNewUser(
            this.config,
            this.userRepository,
            this.accountRepository,
            this.affiliationGroupService,
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
 * @param config
 * @param userRepository
 * @param accountRepository
 * @param affiliationGroupService
 * @param options
 */
export const createNewUser = async (
    config: AccessGroupConfig,
    userRepository: Repository<UserEntity>,
    accountRepository: Repository<AccountEntity>,
    affiliationGroupService: AffiliationGroupService,
    options: {
        oauthID: string;
        provider: Providers;
        email: string;
        username: string;
        picture: string;
    },
): Promise<UserEntity> => {
    if (!isEmailAllowedToSignIn(config, options.email)) {
        throw new AuthFlowException(EXTERNAL_LOGIN_REFUSED_MESSAGE);
    }

    const existingUser = await userRepository.findOne({
        where: { email: options.email },
        relations: {
            account: true,
        },
    });

    // assert that we don't have a user with the same email but a different provider
    if (!!existingUser && existingUser.account) {
        throw new AuthFlowException(
            'User already exists and has a linked account! Please use a different OAuth provider.',
        );
    }

    const account: AccountEntity = accountRepository.create({
        oauthID: options.oauthID,
        provider: options.provider,
    });

    // if the user exists but has no linked account
    if (!!existingUser && !existingUser.account) {
        logger.info(
            `Linking account ${account.uuid} to existing user ${existingUser.uuid}`,
        );
        account.user = existingUser;
        await accountRepository.save(account);
        await syncAffiliationAndReturn(
            affiliationGroupService,
            config,
            existingUser,
            options.email,
        );
        return existingUser;
    }

    /////////////////////////////////////////////////////////
    // Create New User and Link Account
    /////////////////////////////////////////////////////////

    logger.debug(`Creating new user with email ${options.email}`);

    let user: UserEntity = userRepository.create({
        email: options.email,
        name: options.username,
        role: UserRole.USER,
        avatarUrl: options.picture || '',
    });

    user.account = await accountRepository.save(account);
    user = await userRepository.save(user);
    user = await userRepository.findOneOrFail({
        where: { uuid: user.uuid },
        relations: {
            memberships: true,
        },
        select: {
            uuid: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
        },
    });

    /////////////////////////////////////////////////////////
    // Create and Link Access Groups
    /////////////////////////////////////////////////////////

    await affiliationGroupService.createPrimaryGroup(user);

    await affiliationGroupService.addToAffiliationGroups(config, user);

    return await userRepository.findOneOrFail({
        where: { uuid: user.uuid },
        relations: {
            memberships: true,
        },
        select: {
            uuid: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
        },
    });
};
