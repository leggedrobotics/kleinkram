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

const DEFAULT_ACCESS_GROUP_UUID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AuthService implements OnModuleInit {
    constructor(
        private userService: UserService,
        private jwtService: JwtService,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
    ) {}

    async onModuleInit() {
        const legged_robotics_group = await this.accessGroupRepository.findOne({
            where: { uuid: DEFAULT_ACCESS_GROUP_UUID },
        });
        if (!legged_robotics_group) {
            const group = this.accessGroupRepository.create({
                name: 'Legged Robotics',
                uuid: DEFAULT_ACCESS_GROUP_UUID,
                rights: AccessGroupRights.READ,
                personal: false,
            });
            await this.accessGroupRepository.save(group);
        }
    }

    async validateAndCreateUserByGoogle(profile: any): Promise<Account> {
        console.log('creating');
        const { id, emails, displayName } = profile;
        const email = emails[0].value;
        const account = await this.accountRepository.findOne({
            where: { oauthID: id },
        });
        if (account) {
            return account;
        }

        return this.create(id, email, displayName);
    }

    async login(account: Account) {
        const payload: JwtPayload = {
            uuid: account.uuid,
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

        const legged_robotics_group = await this.accessGroupRepository.findOne({
            where: { uuid: DEFAULT_ACCESS_GROUP_UUID },
        });
        if (legged_robotics_group) {
            user.accessGroups.push(legged_robotics_group);
        }
        await this.userRepository.save(user);
        return this.accountRepository.findOneOrFail({
            where: { uuid: saved_account.uuid },
            relations: ['user'],
        });
    }
}
