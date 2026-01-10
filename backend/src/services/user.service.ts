import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import {
    userEntityToCurrentAPIUserDto,
    userEntityToDto,
} from '@/serialization';
import {
    CurrentAPIUserDto,
    PermissionsDto,
    UserDto,
    UsersDto,
} from '@kleinkram/api-dto';
import {
    ApiKeyEntity,
    MissionAccessViewEntity,
    ProjectAccessViewEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { systemUser } from '@kleinkram/backend-common/consts';
import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@kleinkram/shared';
import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, FindOptionsSelect, Repository } from 'typeorm';

@Injectable()
export class UserService implements OnModuleInit {
    constructor(
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        @InjectRepository(ProjectAccessViewEntity)
        private projectAccessView: Repository<ProjectAccessViewEntity>,
        @InjectRepository(ApiKeyEntity)
        private apikeyRepository: Repository<ApiKeyEntity>,
        @InjectRepository(MissionAccessViewEntity)
        private missionAccessView: Repository<MissionAccessViewEntity>,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.userRepository.manager.transaction(async (manager) => {
            const existingSystemUser = await manager.findOne(UserEntity, {
                where: { uuid: systemUser.uuid },
            });
            if (!existingSystemUser) {
                const createdSystemUser = manager.create(
                    UserEntity,
                    systemUser,
                );
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
        select: FindOptionsSelect<UserEntity>,
        relations: FindOptionsRelations<UserEntity>,
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
        return userEntityToCurrentAPIUserDto(user);
    }

    async me(auth: AuthHeader): Promise<CurrentAPIUserDto> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: auth.user.uuid },
            select: ['uuid', 'name', 'email', 'role', 'avatarUrl'],
            relations: [
                'memberships',
                'memberships.accessGroup',
                'memberships.user',
            ],
        });

        return userEntityToCurrentAPIUserDto(user);
    }

    async findAll(skip: number, take: number): Promise<UsersDto> {
        const [users, count] = await this.userRepository.findAndCount({
            skip,
            take,
            where: { hidden: false },
        });

        return {
            users: users.map((u) => userEntityToDto(u)),
            count,
        };
    }

    async promoteUser(usermail: string): Promise<UserDto> {
        const user = await this.userRepository.findOneOrFail({
            where: { email: usermail },
        });
        user.role = UserRole.ADMIN;
        await this.userRepository.save(user);
        return userEntityToDto(user);
    }

    async demoteUser(usermail: string) {
        const user = await this.userRepository.findOneOrFail({
            where: { email: usermail },
        });
        user.role = UserRole.USER;
        await this.userRepository.save(user);
        return userEntityToDto(user);
    }

    async search(
        search: string,
        skip: number,
        take: number,
    ): Promise<UsersDto> {
        // Ensure the search string is not empty or null or less than 3 characters
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (search === null || search === '' || search.length < 3) {
            return {
                users: [],
                count: 0,
            };
        }

        // trim search string to avoid leading/trailing spaces or tabs
        search = search.trim();

        // Use query builder to perform a search on both 'name' and 'email' fields
        const [users, count] = await this.userRepository
            .createQueryBuilder('user')
            .where('(user.name ILIKE :name OR user.email ILIKE :email)', {
                name: `%${search}%`,
                email: `%${search}%`,
            })
            .andWhere('user.hidden = :hidden', { hidden: false })
            .addSelect('user.email')
            .skip(skip)
            .take(take)
            .getManyAndCount();

        const usersDto = users.map((u) => userEntityToDto(u, true));

        // return the email only if it is an exact match
        // otherwise set it to null
        for (const user of usersDto) {
            user.email =
                user.email?.toLowerCase() === search.toLowerCase()
                    ? user.email
                    : null;
        }

        return {
            users: usersDto,
            count,
        };
    }

    /**
     * Get the permissions for a user, including their role,
     * default permission level, and specific project and mission permissions.
     *
     * @param userUuid - UUID of the user
     * @returns PermissionsDto
     * @throws Error if userUuid is null or empty
     */
    async getUserPermissions(userUuid: string): Promise<PermissionsDto> {
        // validate preconditions
        if (!userUuid) {
            throw new Error('User UUID is required to get permissions');
        }

        // Execute independent queries in parallel using Promise.all
        const [user, projectAccessRows, missionAccessRows] = await Promise.all([
            // Query 1: Get User and specific memberships in one go
            this.userRepository.findOne({
                where: { uuid: userUuid },
                relations: ['memberships', 'memberships.accessGroup'],
            }),

            // Query 2: Get Project Access
            this.projectAccessView.find({
                where: { userUuid: userUuid },
                select: ['projectUuid', 'rights'],
            }),

            // Query 3: Get Mission Access
            this.missionAccessView.find({
                where: { userUuid: userUuid },
                select: ['missionUuid', 'rights'],
            }),
        ]);

        if (!user) {
            throw new Error(`User with UUID ${userUuid} not found`);
        }

        // We check if the loaded memberships contain an AFFILIATION type
        const hasAffiliation = user.memberships?.some(
            (m) => m.accessGroup?.type === AccessGroupType.AFFILIATION,
        );

        const defaultPermission: AccessGroupRights = hasAffiliation
            ? AccessGroupRights.WRITE
            : AccessGroupRights.READ;

        // map project accesses
        const projectAccesses = projectAccessRows.map((r) => ({
            uuid: r.projectUuid,
            access: r.rights,
        }));

        const missionAccesses = missionAccessRows.map((r) => ({
            uuid: r.missionUuid,
            access: r.rights,
        }));

        return {
            role: user.role,
            defaultPermission,
            projects: projectAccesses,
            missions: missionAccesses,
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
    ): Promise<{ apiKey: ApiKeyEntity; user: UserEntity }> {
        const user = await this.userRepository.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            where: { api_keys: { apikey } },
            relations: ['api_keys'],
            select: ['uuid', 'name', 'role'],
        });

        const apiKey = await this.apikeyRepository.findOneOrFail({
            where: { apikey },
            // Disable global eager loading to ensure your manual relations take precedence
            loadEagerRelations: false,
            relations: {
                action: {
                    template: true,
                },
                mission: {
                    project: true,
                },
            },
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
