import {ForbiddenException, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import User from './entities/user.entity';
import {UserRole} from '../enum';
import {JWTUser} from '../auth/paramDecorator';
import Account from '../auth/entities/account.entity';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User) private userRepository: Repository<User>,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
    ) {
    }

    async findOneByEmail(email: string) {
        return this.userRepository.findOne({where: {email}});
    }

    async findOneByUUID(uuid: string) {
        return this.userRepository.findOneOrFail({
            where: {uuid},
            relations: ['accessGroups', 'account'],
        });
    }

    async claimAdmin(jwt_user: JWTUser) {
        const nrAdmins = await this.userRepository.count({
            where: {role: UserRole.ADMIN},
        });
        if (nrAdmins > 0) {
            throw new ForbiddenException('Admin already exists');
        }
        const user = await this.userRepository.findOneOrFail({
            where: {uuid: jwt_user.uuid},
        });

        user.role = UserRole.ADMIN;
        await this.userRepository.save(user);
        return user;
    }

    async me(jwt_user: JWTUser) {
        return await this.userRepository.findOneOrFail({
            where: {uuid: jwt_user.uuid},
        });
    }

    async findAll() {
        return this.userRepository.find();
    }

    async promoteUser(usermail: string) {
        const user = await this.userRepository.findOneOrFail({
            where: {email: usermail},
        });
        user.role = UserRole.ADMIN;
        await this.userRepository.save(user);
        return user;
    }

    async demoteUser(usermail: string) {
        const user = await this.userRepository.findOneOrFail({
            where: {email: usermail},
        });
        user.role = UserRole.USER;
        await this.userRepository.save(user);
        return user;
    }
}
