import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { AdminOnly, LoggedIn, UserOnly } from '../auth/roles.decorator';
import { AddUser, AuthRes } from '../auth/paramDecorator';
import {
    QuerySkip,
    QueryString,
    QueryTake,
} from '../validation/queryDecorators';
import { ApiOperation } from '@nestjs/swagger';
import {
    CurrentAPIUserDto,
    UserDto,
    UsersDto,
} from '@common/api/types/User.dto';
import { PermissionsDto } from '@common/api/types/Permissions.dto';
import { NoQueryParamsDto } from '@common/api/types/no-query-params.dto';
import { ApiOkResponse } from '../decarators';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post('claimAdmin')
    @UserOnly()
    @ApiOkResponse({
        description: 'Claimed admin',
        type: CurrentAPIUserDto,
    })
    async claimAdmin(@AddUser() user: AuthRes): Promise<CurrentAPIUserDto> {
        return this.userService.claimAdmin(user);
    }

    @Get('all')
    @AdminOnly()
    @ApiOkResponse({
        description: 'All users',
        type: UsersDto,
    })
    async allUsers(
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ): Promise<UsersDto> {
        return this.userService.findAll(skip, take);
    }

    @Get('me')
    @LoggedIn()
    @ApiOperation({ summary: 'Get the currently logged in user' })
    @ApiOkResponse({
        description: 'The currently logged in user',
        type: CurrentAPIUserDto,
    })
    async me(
        @Query() _query: NoQueryParamsDto,
        @AddUser() user: AuthRes,
    ): Promise<CurrentAPIUserDto | undefined> {
        return await this.userService.me(user);
    }

    @Post('promote')
    @AdminOnly()
    @ApiOkResponse({
        description: 'Claimed admin',
        type: UserDto,
    })
    async promoteUser(@Body() bd: { email: string }): Promise<UserDto> {
        return this.userService.promoteUser(bd.email);
    }

    @Post('demote')
    @AdminOnly()
    @ApiOkResponse({
        description: 'Claimed admin',
        type: UserDto,
    })
    async demoteUser(@Body() bd: { email: string }): Promise<UserDto> {
        return this.userService.demoteUser(bd.email);
    }

    @Get('search')
    @LoggedIn()
    @ApiOkResponse({
        description: 'Search results',
        type: UsersDto,
    })
    async search(
        @QueryString('search', 'Searchkey on name or email') search: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ): Promise<UsersDto> {
        return this.userService.search(search, skip, take);
    }

    @Get('permissions')
    @LoggedIn()
    @ApiOkResponse({
        type: PermissionsDto,
        description: 'The permissions of the currently logged in user',
    })
    async permissions(@AddUser() user: AuthRes): Promise<PermissionsDto> {
        return this.userService.permissions(user);
    }
}
