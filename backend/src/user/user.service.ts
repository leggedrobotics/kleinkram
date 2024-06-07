import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import User from './entities/user.entity';
import { AccountType, UserRole } from '../enum';
import { JWTUser } from '../auth/paramDecorator';
import Account from '../auth/entities/account.entity';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User) private userRepository: Repository<User>,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
    ) {}
    async findOneByEmail(email: string) {
        return this.userRepository.findOne({ where: { email } });
    }

    async findOneById(oauthID: string) {
        const account = await this.accountRepository.findOneOrFail({
            where: { oauthID: oauthID },
            relations: ['user'],
        });
        return account.user;
    }

    async claimAdmin(jwtuser: JWTUser) {
        const nrAdmins = await this.userRepository.count({
            where: { role: UserRole.ADMIN },
        });
        if (nrAdmins > 0) {
            throw new ForbiddenException('Admin already exists');
        }
        const account = await this.accountRepository.findOneOrFail({
            where: { oauthID: jwtuser.userId },
            relations: ['user'],
        });

        account.user.role = UserRole.ADMIN;
        await this.userRepository.save(account.user);
        return account.user;
    }

    async me(jwtuser: JWTUser) {
        const account = await this.accountRepository.findOneOrFail({
            where: { oauthID: jwtuser.userId },
            relations: ['user'],
        });
        return account.user;
    }

    async findAll() {
        return this.userRepository.find();
    }

    async promoteUser(usermail: string) {
        const user = await this.userRepository.findOneOrFail({
            where: { email: usermail },
        });
        user.role = UserRole.ADMIN;
        await this.userRepository.save(user);
        return user;
    }

    async demoteUser(usermail: string) {
        const user = await this.userRepository.findOneOrFail({
            where: { email: usermail },
        });
        user.role = UserRole.USER;
        await this.userRepository.save(user);
        return user;
    }
}
