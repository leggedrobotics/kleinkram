import { AuthFlowException } from '@/types/auth-flow-exception';
import { AffiliationGroupService } from '@kleinkram/backend-common';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import {
    AccessGroupConfig,
    CookieNames,
    Providers,
    UserRole,
} from '@kleinkram/shared';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtPayload } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import logger from '../logger';

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly config: AccessGroupConfig;

    constructor(
        private jwtService: JwtService,
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
        await this.affiliationGroupService.createAccessGroups(this.config);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async validateAndCreateUserByGitHub(profile: any): Promise<UserEntity> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { id, emails, displayName, photos } = profile;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const email = emails[0].value;

        const account = await this.accountRepository.findOne({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            where: { oauthID: id, provider: Providers.GITHUB },
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            id,
            Providers.GITHUB,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            email,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            displayName,

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            photos[0].value,
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async validateAndCreateUserByFakeOAuth(profile: any): Promise<UserEntity> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { id, email, displayName, photo } = profile;

        const account = await this.accountRepository.findOne({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            where: { oauthID: id, provider: Providers.FakeOAuth },
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return this.create(id, Providers.FakeOAuth, email, displayName, photo);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async validateAndCreateUserByGoogle(profile: any): Promise<UserEntity> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { id, emails, displayName, photos } = profile;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const email = emails[0].value;

        const account = await this.accountRepository.findOne({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            id,
            Providers.GOOGLE,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            email,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            displayName,

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            photos[0].value,
        );
    }

    login(user: UserEntity) {
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
    const existingUser = await userRepository.findOne({
        where: { email: options.email },
        relations: ['account'],
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
        return accountRepository.save(account).then(() => existingUser);
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
        relations: ['memberships'],
        select: ['uuid', 'name', 'email', 'role', 'avatarUrl'],
    });

    /////////////////////////////////////////////////////////
    // Create and Link Access Groups
    /////////////////////////////////////////////////////////

    await affiliationGroupService.createPrimaryGroup(user);

    await affiliationGroupService.addToAffiliationGroups(config, user);

    return await userRepository.findOneOrFail({
        where: { uuid: user.uuid },
        relations: ['memberships'],
        select: ['uuid', 'name', 'email', 'role', 'avatarUrl'],
    });
};
