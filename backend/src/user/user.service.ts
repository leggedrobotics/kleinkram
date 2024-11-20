import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, FindOptionsSelect, Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import { AccessGroupType, UserRole } from '@common/frontend_shared/enum';
import { AuthRes } from '../auth/paramDecorator';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import { systemUser } from '@common/consts';
import { CurrentAPIUserDto } from '@common/api/types/User.dto';

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

    /**
     * Find a user by their UUID.
     *
     * @param uuid
     * @param select
     * @param relations
     */
    async findOneByUUID(
        uuid: string,
        select?: FindOptionsSelect<User>,
        relations?: FindOptionsRelations<User>,
    ) {
        return this.userRepository.findOneOrFail({
            where: { uuid },
            select,
            relations,
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

    async me(auth: AuthRes): Promise<CurrentAPIUserDto> {
        return (await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
            select: ['uuid', 'name', 'email', 'role', 'avatarUrl'],
            relations: ['memberships', 'memberships.accessGroup'],
        })) as CurrentAPIUserDto;
    }

    async findAll(skip: number, take: number) {
        return this.userRepository.find({
            skip,
            take,
            where: { hidden: false },
        });
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

    async search(search: string, skip: number, take: number) {
        // Ensure the search string is not empty or null
        if (!search) {
            return [];
        }

        // Use query builder to perform a search on both 'name' and 'email' fields
        return this.userRepository
            .createQueryBuilder('user')
            .where('(user.name ILIKE :name OR user.email ILIKE :email)', {
                name: `%${search}%`,
                email: `%${search}%`,
            })
            .andWhere('user.hidden = :hidden', { hidden: false })
            .skip(skip)
            .take(take)
            .getMany();
    }

    async permissions(auth: AuthRes) {
        let user = await this.userRepository.findOne({
            where: {
                uuid: auth.user.uuid,
                memberships: {
                    accessGroup: { type: AccessGroupType.AFFILIATION },
                },
            },
            relations: ['memberships'],
            select: ['uuid', 'role'],
        });
        let defaultPermission;
        if (!user) {
            user = await this.userRepository.findOneOrFail({
                where: { uuid: auth.user.uuid },
                select: ['uuid', 'role'],
            });
            defaultPermission = 0;
        } else {
            defaultPermission = user.memberships.length > 0 ? 10 : 0;
        }

        const role = user.role;

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

        return {
            role,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            default_permission: defaultPermission,
            projects,
            missions,
        };
    }

    async findOneByApiKey(apikey: string) {
        const user = await this.userRepository.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            where: { api_keys: { apikey } },
            relations: ['api_keys'],
            select: ['uuid', 'name', 'role'],
        });
        const apiKey = await this.apikeyRepository.findOneOrFail({
            where: { apikey },
            relations: ['action'],
        });
        return { user, apiKey };
    }

    /**
     * Get the number of members in a group
     * @param uuid
     */
    async getMemberCount(uuid: string): Promise<number> {
        return this.userRepository.count({
            where: { memberships: { accessGroup: { uuid } } },
        });
    }
}
