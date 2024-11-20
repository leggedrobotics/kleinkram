import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { AdminOnly, LoggedIn, UserOnly } from '../auth/roles.decorator';
import { addUser, AuthRes } from '../auth/paramDecorator';
import {
    QuerySkip,
    QueryString,
    QueryTake,
} from '../validation/queryDecorators';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { CurrentAPIUserDto, UserDto } from '@common/api/types/User.dto';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post('claimAdmin')
    @UserOnly()
    async claimAdmin(@addUser() user?: AuthRes) {
        return this.userService.claimAdmin(user);
    }

    @Get('all')
    @AdminOnly()
    async allUsers(
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return this.userService.findAll(skip, take);
    }

    @Get('me')
    @LoggedIn()
    @ApiOperation({
        summary: 'Get the currently logged in user',
    })
    @ApiOkResponse({
        description: 'The currently logged in user',
        type: CurrentAPIUserDto,
    })
    async me(@addUser() user?: AuthRes) {
        return this.userService.me(user);
    }

    @Post('promote')
    @AdminOnly()
    async promoteUser(@Body() bd: { email: string }) {
        return this.userService.promoteUser(bd.email);
    }

    @Post('demote')
    @AdminOnly()
    async demoteUser(@Body() bd: { email: string }) {
        return this.userService.demoteUser(bd.email);
    }

    @Get('search')
    @LoggedIn()
    async search(
        @QueryString('search', 'Searchkey on name or email') search: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
    ) {
        return this.userService.search(search, skip, take);
    }

    /**
     *
     * Returns a JSON object describing the access rights of the
     * currently logged in user.
     *
     * Examples:
     *
     * {
     *     "role": "ADMIN",
     * }
     *
     * {
     *     "role": "USER",
     *     "default_permission: "10",
     *
     *     // access rights to projects and missions above the default
     *     // permission level
     *     "projects": [
     *        {
     *          "uuid": "b1b4b3b4-1b3b-4b3b-1b3b-4b3b1b3b4b3b",
     *          "access": "10"
     *        }
     *     ],
     *     "missions": [
     *        {
     *         "uuid": "b1b4b3b4-1b3b-4b3b-1b3b-4b3b1b3b4b3b",
     *         "access": "10"
     *        }
     *     ],
     *
     * }
     *
     */
    @Get('permissions')
    @LoggedIn()
    async permissions(@addUser() user?: AuthRes) {
        return this.userService.permissions(user);
    }
}
