import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserService } from '../../services/user.service';
import { AdminOnly, LoggedIn, UserOnly } from '../auth/roles.decorator';
import {
    QuerySkip,
    QueryString,
    QueryTake,
} from '../../validation/query-decorators';
import { ApiOperation } from '@nestjs/swagger';
import {
    CurrentAPIUserDto,
    UserDto,
    UsersDto,
} from '@common/api/types/user.dto';
import { IsString } from 'class-validator';
import { PermissionsDto } from '@common/api/types/permissions.dto';
import { NoQueryParametersDto } from '@common/api/types/no-query-parameters.dto';
import { ApiOkResponse, OutputDto } from '../../decarators';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { PaginatedQueryDto } from '@common/api/types/pagination.dto';
import { ApiProperty } from '@nestjs/swagger';

class SearchUserDto {
    @IsString()
    @ApiProperty()
    search!: string;
}

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
        @Query() query: SearchUserDto & PaginatedQueryDto,
    ): Promise<UsersDto> {
        return this.userService.search(query.search, query.skip, query.take);
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
