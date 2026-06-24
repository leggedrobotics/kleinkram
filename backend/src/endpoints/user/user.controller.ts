import { ApiCreatedResponse, ApiOkResponse, OutputDto } from '@/decorators';
import { UserService } from '@/services/user.service';
import {
    ApiKeysDto,
    CurrentAPIUserDto,
    NoQueryParametersDto,
    PaginatedQueryDto,
    PermissionsDto,
    ResolveUsersDto,
    SortablePaginatedQueryDto,
    UserDto,
    UsersDto,
} from '@kleinkram/api-dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
    ApiOperation,
    ApiCreatedResponse as SwaggerApiCreatedResponse,
} from '@nestjs/swagger';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { AdminOnly, LoggedIn, UserOnly } from '../auth/roles.decorator';

@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post('admin/claim')
    @UserOnly()
    @ApiCreatedResponse({
        description: 'Claimed admin',
        type: CurrentAPIUserDto,
    })
    async claimAdmin(@AddUser() user: AuthHeader): Promise<CurrentAPIUserDto> {
        return this.userService.claimAdmin(user);
    }

    @Get()
    @AdminOnly()
    @ApiOkResponse({
        description: 'All users',
        type: UsersDto,
    })
    async allUsers(@Query() query: PaginatedQueryDto): Promise<UsersDto> {
        return this.userService.findAll(query.skip, query.take);
    }

    @Get('me')
    @LoggedIn()
    @ApiOperation({ summary: 'Get the currently logged in user' })
    @ApiOkResponse({
        description: 'The currently logged in user',
        type: CurrentAPIUserDto,
    })
    async me(
        @Query() _query: NoQueryParametersDto,
        @AddUser() user: AuthHeader,
    ): Promise<CurrentAPIUserDto> {
        return await this.userService.me(user);
    }

    @Post('promote')
    @AdminOnly()
    @ApiCreatedResponse({
        description: 'Claimed admin',
        type: UserDto,
    })
    async promoteUser(@Body() bd: { email: string }): Promise<UserDto> {
        return this.userService.promoteUser(bd.email);
    }

    @Post('demote')
    @AdminOnly()
    @ApiCreatedResponse({
        description: 'Claimed admin',
        type: UserDto,
    })
    async demoteUser(@Body() bd: { email: string }): Promise<UserDto> {
        return this.userService.demoteUser(bd.email);
    }

    @Get('search')
    @LoggedIn()
    @OutputDto(UsersDto)
    async search(@Query() query: PaginatedQueryDto): Promise<UsersDto> {
        return this.userService.search(
            query.search ?? '',
            query.skip,
            query.take,
        );
    }

    @Get('me/permissions')
    @LoggedIn()
    @ApiOkResponse({
        type: PermissionsDto,
        description: 'The permissions of the currently logged in user',
    })
    async permissions(
        @AddUser() authHeader: AuthHeader,
    ): Promise<PermissionsDto> {
        return this.userService.getUserPermissions(authHeader.user.uuid);
    }

    @Get('me/api-keys')
    @LoggedIn()
    @ApiOperation({ summary: 'Get API key metadata for the current user' })
    @ApiOkResponse({
        description: 'API key metadata (excluding secret key values)',
        type: ApiKeysDto,
    })
    async apiKeys(
        @AddUser() authHeader: AuthHeader,
        @Query() query: SortablePaginatedQueryDto,
    ): Promise<ApiKeysDto> {
        return this.userService.getApiKeysForUser(
            authHeader.user.uuid,
            query.skip,
            query.take,
            query.sortBy ?? 'createdAt',
            query.sortOrder,
        );
    }

    @Post('resolve')
    @LoggedIn()
    @ApiOperation({ summary: 'Resolve a list of User UUIDs to their names' })
    @OutputDto(null)
    @SwaggerApiCreatedResponse({
        description: 'Mapping from user UUIDs to their display names',
        schema: {
            type: 'object',
            additionalProperties: { type: 'string' },
        },
    })
    async resolve(
        @Body() body: ResolveUsersDto,
    ): Promise<Record<string, string>> {
        return this.userService.resolveUsers(body.uuids);
    }
}
