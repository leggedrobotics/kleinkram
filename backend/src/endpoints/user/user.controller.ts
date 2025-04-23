import { NoQueryParametersDto } from '@common/api/types/no-query-parameters.dto';
import { PermissionsDto } from '@common/api/types/permissions.dto';
import {
    CurrentAPIUserDto,
    UserDto,
    UsersDto,
} from '@common/api/types/user.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { UserService } from '../../services/user.service';
import {
    QuerySkip,
    QueryString,
    QueryTake,
} from '../../validation/query-decorators';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { AdminOnly, LoggedIn, UserOnly } from '../auth/roles.decorator';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post('claimAdmin')
    @UserOnly()
    @ApiOkResponse({
        description: 'Claimed admin',
        type: CurrentAPIUserDto,
    })
    async claimAdmin(@AddUser() user: AuthHeader): Promise<CurrentAPIUserDto> {
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
        @Query() _query: NoQueryParametersDto,
        @AddUser() user: AuthHeader,
    ): Promise<CurrentAPIUserDto> {
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
    @OutputDto(null) // TODO: Add type
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
    async permissions(@AddUser() user: AuthHeader): Promise<PermissionsDto> {
        return this.userService.permissions(user);
    }
}
