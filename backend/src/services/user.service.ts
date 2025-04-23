import { PermissionsDto } from '@common/api/types/permissions.dto';
import {
    CurrentAPIUserDto,
    UserDto,
    UsersDto,
} from '@common/api/types/user.dto';
import { systemUser } from '@common/consts';
import Apikey from '@common/entities/auth/apikey.entity';
import User from '@common/entities/user/user.entity';
import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@common/frontend_shared/enum';
import { ProjectAccessViewEntity } from '@common/viewEntities/project-access-view.entity';
import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, FindOptionsSelect, Repository } from 'typeorm';
import { AuthHeader } from '../endpoints/auth/parameter-decorator';

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
        select: FindOptionsSelect<User>,
        relations: FindOptionsRelations<User>,
    ) {
        return this.userRepository.findOneOrFail({
            where: { uuid },
            select,
            relations,
        });
    }

    async claimAdmin(auth: AuthHeader): Promise<CurrentAPIUserDto> {
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
        return user as unknown as CurrentAPIUserDto;
    }

    async me(auth: AuthHeader): Promise<CurrentAPIUserDto> {
        return (await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
            select: ['uuid', 'name', 'email', 'role', 'avatarUrl'],
            relations: ['memberships', 'memberships.accessGroup'],
        })) as unknown as CurrentAPIUserDto;
    }

    async findAll(skip: number, take: number): Promise<UsersDto> {
        const [user, count] = await this.userRepository.findAndCount({
            skip,
            take,
            where: { hidden: false },
        });

        return {
            users: user as UserDto[],
            count,
        };
    }

    async promoteUser(usermail: string): Promise<UserDto> {
        const user = await this.userRepository.findOneOrFail({
            where: { email: usermail },
        });
        user.role = UserRole.ADMIN;
        await this.userRepository.save(user);
        return user as unknown as UserDto;
    }

    async demoteUser(usermail: string) {
        const user = await this.userRepository.findOneOrFail({
            where: { email: usermail },
        });
        user.role = UserRole.USER;
        await this.userRepository.save(user);
        return user as unknown as UserDto;
    }

    async search(
        search: string,
        skip: number,
        take: number,
    ): Promise<UsersDto> {
        // Ensure the search string is not empty or null or less than 3 characters
        if (search === null || search === '' || search.length < 3) {
            return {
                users: [],
                count: 0,
            };
        }

        // Use query builder to perform a search on both 'name' and 'email' fields
        const [users, count] = await this.userRepository
            .createQueryBuilder('user')
            .where('(user.name ILIKE :name OR user.email ILIKE :email)', {
                name: `%${search}%`,
                email: `%${search}%`,
            })
            .andWhere('user.hidden = :hidden', { hidden: false })
            .skip(skip)
            .take(take)
            .getManyAndCount();

        return {
            users: users as UserDto[],
            count,
        };
    }

    async permissions(auth: AuthHeader): Promise<PermissionsDto> {
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

        let defaultPermission: AccessGroupRights;
        if (user === null) {
            user = await this.userRepository.findOneOrFail({
                where: { uuid: auth.user.uuid },
                select: ['uuid', 'role'],
            });
            defaultPermission = 0;
        } else {
            if (user.memberships === undefined)
                throw new Error('Membership undefined');

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
            defaultPermission,
            projects,
            missions,
        } as PermissionsDto;
    }

    /**
     * Find a user by their API key.
     *
     * Returns the user and the API key.
     * Fails if the user or API key is not found.
     *
     */
    async findUserByAPIKey(
        apikey: string,
    ): Promise<{ apiKey: Apikey; user: User }> {
        const user = await this.userRepository.findOneOrFail({
            where: { api_keys: { apikey } },
            relations: ['api_keys'],
            select: ['uuid', 'name', 'role'],
        });

        const apiKey = await this.apikeyRepository.findOneOrFail({
            where: { apikey },
            relations: ['action', 'mission.project'],
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
