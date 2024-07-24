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
import {
    AccessGroupRights,
    CookieNames,
    Providers,
    UserRole,
} from '@common/enum';

import access_config from '../../access_config.json';
import { ConfigService } from '@nestjs/config';
import { AccessGroupConfig } from '../app.module';

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
        private configService: ConfigService,
    ) {
        this.config = this.configService.get('accessConfig');
    }

    async onModuleInit() {
        // Read access_config/*.json and create access groups
        await Promise.all(
            this.config.access_groups.map(async (group) => {
                const db_group = await this.accessGroupRepository.findOne({
                    where: { uuid: group.uuid },
                });
                if (!db_group) {
                    const new_group = this.accessGroupRepository.create({
                        name: group.name,
                        uuid: group.uuid,
                        personal: false,
                        inheriting: true,
                    });
                    return this.accessGroupRepository.save(new_group);
                }
            }),
        );
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
        const existing_user = await this.userRepository.findOne({
            where: { email: email },
            relations: ['account'],
        });

        // assert that we don't have a user with the same email but a different provider
        if (!!existing_user && existing_user.account) {
            throw new AuthFlowException(
                'User already exists and has a linked account!',
            );
        }

        const account: Account = this.accountRepository.create({
            oauthID: oauthID,
            provider: provider,
        });

        // if the user exists but has no linked account
        if (!!existing_user && !existing_user.account) {
            logger.debug(
                `Linking account ${account} to existing user ${existing_user.uuid}`,
            );
            account.user = existing_user;
            return this.accountRepository
                .save(account)
                .then(() => existing_user);
        }

        logger.debug(`Creating new user with email ${email}`);

        /////////////////////////////////////////////////////////
        // Create New User and Link Account
        /////////////////////////////////////////////////////////
        const user: User = this.userRepository.create({
            email: email,
            name: username,
            role: UserRole.USER,
            avatarUrl: picture || '',
        });

        user.account = await this.accountRepository.save(account);
        const saved_user = await this.userRepository.save(user);

        const personal_group = this.accessGroupRepository.create({
            name: `Personal: ${saved_user.name}`,
            users: [saved_user],
            personal: true,
        });
        await this.accessGroupRepository.save(personal_group);
        user.accessGroups = [personal_group];

        this.config.emails.forEach((config) => {
            if (user.email.endsWith(config.email)) {
                config.access_groups?.forEach(async (uuid) => {
                    const group = await this.accessGroupRepository.findOne({
                        where: { uuid },
                    });
                    if (group) {
                        user.accessGroups.push(group);
                    }
                });
            }
        });

        const new_user = await this.userRepository.save(user);
        return this.userRepository.findOneOrFail({
            where: { uuid: new_user.uuid },
            relations: ['account'],
        });
    }
}
