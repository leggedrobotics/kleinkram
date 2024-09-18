import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { AdminOnly, LoggedIn } from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';
import {
    QuerySkip,
    QueryString,
    QueryTake,
} from '../validation/queryDecorators';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post('claimAdmin')
    @LoggedIn()
    async claimAdmin(@addJWTUser() user?: JWTUser) {
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
    async me(@addJWTUser() user?: JWTUser) {
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
        @QueryString('search') search: string,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.userService.search(user, search, skip, take);
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
    async permissions(@addJWTUser() user?: JWTUser) {
        return this.userService.permissions(user);
    }
}
