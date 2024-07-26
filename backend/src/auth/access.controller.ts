import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AccessService } from './access.service';
import { CanWriteProject, LoggedIn } from './roles.decorator';
import { addJWTUser, JWTUser } from './paramDecorator';
import { AccessGroupRights } from '@common/enum';

@Controller('access')
export class AccessController {
    constructor(private readonly accessService: AccessService) {}

    @Post('createAccessGroup')
    @LoggedIn()
    async createAccessGroup(
        @Body('name') name: string,
        @addJWTUser() user: JWTUser,
    ) {
        return this.accessService.createAccessGroup(name, user);
    }

    @Get('canAddAccessGroupToProject')
    @LoggedIn()
    async canAddAccessGroup(
        @Query('uuid') uuid: string,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.accessService.canAddAccessGroup(uuid, user);
    }

    @Post('addUserToProject')
    @CanWriteProject()
    async addUserToProject(
        @Body('uuid') uuid: string,
        @Body('userUUID') userUUID: string,
        @Body('rights') rights: AccessGroupRights,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.accessService.addUserToProject(uuid, userUUID, rights);
    }

    @Post('addUserToAccessGroup')
    @LoggedIn() //#Todo write a decorator for this
    async addUserToAccessGroup(
        @Body('uuid') uuid: string,
        @Body('userUUID') userUUID: string,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.accessService.addUserToAccessGroup(uuid, userUUID);
    }

    @Get('searchAccessGroup')
    @LoggedIn()
    async search(
        @Query('search') search: string,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.accessService.searchAccessGroup(search, user);
    }

    @Post('addAccessGroupToProject')
    @CanWriteProject()
    async addAccessGroupToProject(
        @Body('uuid') uuid: string,
        @Body('accessGroupUUID') accessGroupUUID: string,
        @Body('rights') rights: AccessGroupRights,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.accessService.addAccessGroupToProject(
            uuid,
            accessGroupUUID,
            rights,
            user,
        );
    }
}
