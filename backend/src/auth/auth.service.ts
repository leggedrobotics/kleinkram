import { Injectable, OnModuleInit } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import User from '../user/entities/user.entity';
import { JwtPayload } from 'jsonwebtoken';
import { AccessGroupRights, AccountType, CookieNames, UserRole } from '../enum';
import Account from './entities/account.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import AccessGroup from './entities/accessgroup.entity';
import Project from '../project/entities/project.entity';

type AccessGroupConfig = {
    emails: [{ email: string; access_groups: string[] }];
    access_groups: [{ name: string; uuid: string; rights: number }];
};

@Injectable()
export class AuthService implements OnModuleInit {
    config: AccessGroupConfig;
    constructor(
        private userService: UserService,
        private jwtService: JwtService,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
    ) {
        try {
            this.config = require('../../../access_config.json');
        } catch (e) {
            console.error('No access_config.json found');
        }
    }

    async onModuleInit() {
        if (!this.config) {
            return;
        }
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
                        rights: group.rights,
                        personal: false,
                        inheriting: true,
                    });
                    return this.accessGroupRepository.save(new_group);
                }
            }),
        );
    }

    async validateAndCreateUserByGoogle(profile: any): Promise<User> {
        const { id, emails, displayName } = profile;
        const email = emails[0].value;
        const account = await this.accountRepository.findOne({
            where: { oauthID: id },
            relations: ['user'],
        });
        if (account) {
            return account.user;
        }

        return this.create(id, email, displayName);
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

    async create(oauthID: string, email: string, username: string) {
        const account: Account = this.accountRepository.create({
            oauthID: oauthID,
            type: AccountType.GOOGLE,
        });

        const user: User = this.userRepository.create({
            email: email,
            name: username,
            role: UserRole.USER,
        });

        const saved_account = await this.accountRepository.save(account);
        user.account = saved_account;
        const saved_user = await this.userRepository.save(user);

        const personal_group = this.accessGroupRepository.create({
            name: `Personal: ${saved_user.name}`,
            rights: AccessGroupRights.WRITE,
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
