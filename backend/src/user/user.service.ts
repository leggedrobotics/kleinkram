import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import { UserRole } from '@common/enum';
import { JWTUser } from '../auth/paramDecorator';
import Account from '@common/entities/auth/account.entity';

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

    async findOneByUUID(uuid: string) {
        return this.userRepository.findOneOrFail({
            where: { uuid },
            relations: ['accessGroups', 'account'],
        });
    }

    async claimAdmin(jwt_user: JWTUser) {
        const nrAdmins = await this.userRepository.count({
            where: { role: UserRole.ADMIN },
        });
        if (nrAdmins > 0) {
            throw new ForbiddenException('Admin already exists');
        }
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: jwt_user.uuid },
        });

        user.role = UserRole.ADMIN;
        await this.userRepository.save(user);
        return user;
    }

    async me(jwt_user: JWTUser) {
        return await this.userRepository.findOneOrFail({
            where: { uuid: jwt_user.uuid },
            relations: ['accessGroups'],
        });
    }

    async findAll(skip: number, take: number) {
        return this.userRepository.find({ skip, take });
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

    async search(user: JWTUser, search: string, skip: number, take: number) {
        // Ensure the search string is not empty or null
        if (!search) {
            return [];
        }

        // Use query builder to perform a search on both 'name' and 'email' fields
        return this.userRepository
            .createQueryBuilder('user')
            .where('user.name ILIKE :search', { search: `%${search}%` })
            .orWhere('user.email ILIKE :search', { search: `%${search}%` })
            .skip(skip)
            .take(take)
            .getMany();
    }
}
