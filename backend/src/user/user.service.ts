import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import { UserRole } from '@common/enum';
import { AuthRes } from '../auth/paramDecorator';
import Account from '@common/entities/auth/account.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import { systemUser } from '@common/consts';

@Injectable()
export class UserService implements OnModuleInit {
    constructor(
        @InjectRepository(User) private userRepository: Repository<User>,
        @InjectRepository(ProjectAccessViewEntity)
        private projectAccessView: Repository<ProjectAccessViewEntity>,
        @InjectRepository(Apikey) private apikeyRepository: Repository<Apikey>,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.userRepository.manager.transaction(async (manager) => {
            const existingSystemUser = await manager.findOne(User, {
                where: { uuid: systemUser.uuid },
            });
            if (!existingSystemUser) {
                const createdSystemUser = manager.create(User, systemUser);
                await manager.save(createdSystemUser);
            }
        });
    }

    async findOneByEmail(email: string) {
        return this.userRepository.findOne({ where: { email } });
    }

    async findOneByUUID(uuid: string) {
        return this.userRepository.findOneOrFail({
            where: { uuid },
            relations: ['accessGroups', 'account'],
        });
    }

    async claimAdmin(auth: AuthRes) {
        const nrAdmins = await this.userRepository.count({
            where: { role: UserRole.ADMIN },
        });
        if (nrAdmins > 0) {
            throw new ForbiddenException('Admin already exists');
        }
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
        });

        user.role = UserRole.ADMIN;
        await this.userRepository.save(user);
        return user;
    }

    async me(auth: AuthRes) {
        return await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
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

    async search(user: AuthRes, search: string, skip: number, take: number) {
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

    async permissions(auth: AuthRes) {
        let user = await this.userRepository.findOne({
            where: {
                uuid: auth.user.uuid,
                accessGroups: { inheriting: true },
            },
            relations: ['accessGroups'],
        });

        if (!user) {
            user = await this.userRepository.findOneOrFail({
                where: { uuid: auth.user.uuid },
            });
        }

        const role = user.role;
        const default_permission = user.accessGroups?.length > 0 ? 10 : 0;

        const projects: {
            uuid: string;
            access: number;
        }[] = await this.projectAccessView
            .createQueryBuilder('project')
            .select('project.projectUUID', 'uuid')
            .addSelect('MAX(project.rights)', 'access')
            .where('project.userUUID = :userUUID', { userUUID: user.uuid })
            .groupBy('project.projectUUID')
            .getRawMany();

        // TODO: Implement missions once we have mission level access control
        const missions: {
            uuid: string;
            access: number;
        }[] = [];

        return { role, default_permission, projects, missions };
    }

    async findOneByApiKey(apikey: string) {
        const user = await this.userRepository.findOneOrFail({
            where: { api_keys: { apikey } },
            relations: ['api_keys'],
        });
        const apiKey = await this.apikeyRepository.findOneOrFail({
            where: { apikey },
            relations: ['action'],
        });
        return { user, apiKey };
    }
}
