import { Injectable, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from 'jsonwebtoken';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import logger from '../logger';
import { AuthFlowException } from './authFlowException';
import Account from '@common/entities/auth/account.entity';
import User from '@common/entities/user/user.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { CookieNames, Providers, UserRole } from '@common/enum';
import { ConfigService } from '@nestjs/config';
import { AccessGroupConfig } from '../app.module';
import AccessGroupUser from '@common/entities/auth/accessgroup_user.entity';

@Injectable()
export class AuthService implements OnModuleInit {
    private config: AccessGroupConfig;

    constructor(
        private jwtService: JwtService,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(AccessGroupUser)
        private accessGroupUserRepository: Repository<AccessGroupUser>,
        private configService: ConfigService,
    ) {
        this.config = this.configService.get('accessConfig');
    }

    async onModuleInit() {
        await createAccessGroups(this.accessGroupRepository, this.config);
    }

    async validateAndCreateUserByGoogle(profile: any): Promise<User> {
        const { id, emails, displayName, photos } = profile;
        const email = emails[0].value;

        const account = await this.accountRepository.findOne({
            where: { oauthID: id, provider: Providers.GOOGLE },
            relations: ['user'],
        });

        if (account && !account.user) {
            logger.error('Account exists but has no linked user!');
            throw new AuthFlowException(
                'Account exists but has no linked user!',
            );
        }

        if (account) {
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

    async login(user: User) {
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
            this.accessGroupUserRepository,
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

export const createAccessGroups = async (
    accessGroupRepository,
    config: AccessGroupConfig,
) => {
    // Read access_config/*.json and create access groups
    await Promise.all(
        config.access_groups.map(async (group) => {
            const dbGroup = await accessGroupRepository.findOne({
                where: { uuid: group.uuid },
            });
            if (!dbGroup) {
                const newGroup = accessGroupRepository.create({
                    name: group.name,
                    uuid: group.uuid,
                    personal: false,
                    inheriting: true,
                    creator: null,
                });
                return accessGroupRepository.save(newGroup);
            }
        }),
    );
};

export const createNewUser = async (
    config,
    userRepository,
    accountRepository,
    accessGroupRepository,
    accessGroupUserRepository,
    options: {
        oauthID: string;
        provider: Providers;
        email: string;
        username: string;
        picture: string;
    },
) => {
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
        logger.debug(
            `Linking account ${account} to existing user ${existingUser.uuid}`,
        );
        account.user = existingUser;
        return accountRepository.save(account).then(() => existingUser);
    }

    logger.debug(`Creating new user with email ${options.email}`);

    /////////////////////////////////////////////////////////
    // Create New User and Link Account
    /////////////////////////////////////////////////////////
    const user: User = userRepository.create({
        email: options.email,
        name: options.username,
        role: UserRole.USER,
        avatarUrl: options.picture || '',
    });

    user.account = await accountRepository.save(account);
    const savedUser = await userRepository.save(user);

    const personalGroup = accessGroupRepository.create({
        name: `Personal: ${savedUser.name}`,
        users: [savedUser],
        personal: true,
    });
    await accessGroupRepository.save(personalGroup);

    const personalAccessGroupUser = accessGroupUserRepository.create({
        user: { uuid: savedUser.uuid },
        accessGroup: { uuid: personalGroup.uuid },
        expirationDate: null,
    });
    await accessGroupUserRepository.save(personalAccessGroupUser);

    user.accessGroupUsers = [personalAccessGroupUser];

    config.emails?.forEach((_config) => {
        if (user.email.endsWith(_config.email)) {
            _config.access_groups?.forEach(async (uuid) => {
                const group = await accessGroupRepository.findOne({
                    where: { uuid },
                });
                if (group) {
                    const institutionalAccessGroupUser =
                        accessGroupUserRepository.create({
                            user: { uuid: savedUser.uuid },
                            accessGroup: { uuid: group.uuid },
                            expirationDate: null,
                        });
                    await accessGroupUserRepository.save(
                        institutionalAccessGroupUser,
                    );
                    user.accessGroupUsers.push(institutionalAccessGroupUser);
                }
            });
        }
    });

    const newUser = await userRepository.save(user);
    return userRepository.findOneOrFail({
        where: { uuid: newUser.uuid },
        relations: ['account'],
    });
};
