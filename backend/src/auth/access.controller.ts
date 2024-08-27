import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AccessService } from './access.service';
import {
    CanAddUserToAccessGroup,
    CanWriteProject,
    LoggedIn,
} from './roles.decorator';
import { addJWTUser, JWTUser } from './paramDecorator';
import { AccessGroupRights } from '@common/enum';
import {
    BodyAccessGroupRights,
    BodyString,
    BodyUUID,
} from '../validation/bodyDecorators';
import {
    QueryOptionalBoolean,
    QueryOptionalString,
    QuerySkip,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';

@Controller('access')
export class AccessController {
    constructor(private readonly accessService: AccessService) {}

    @Get('one')
    @LoggedIn()
    async getAccessGroup(
        @QueryString('uuid') uuid: string,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.accessService.getAccessGroup(uuid, user);
    }

    @Post('createAccessGroup')
    @LoggedIn()
    async createAccessGroup(
        @BodyString('name') name: string,
        @addJWTUser() user: JWTUser,
    ) {
        return this.accessService.createAccessGroup(name, user);
    }

    @Get('canAddAccessGroupToProject')
    @LoggedIn()
    async canAddAccessGroup(
        @QueryUUID('uuid') uuid: string,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.accessService.canModifyAccessGroup(uuid, user);
    }

    @Post('addUserToProject')
    @CanWriteProject()
    async addUserToProject(
        @BodyUUID('uuid') uuid: string,
        @BodyUUID('userUUID') userUUID: string,
        @BodyAccessGroupRights('rights') rights: AccessGroupRights,
        @addJWTUser() requestUser?: JWTUser,
    ) {
        return this.accessService.addUserToProject(
            uuid,
            userUUID,
            rights,
            requestUser,
        );
    }

    @Post('addUserToAccessGroup')
    @CanAddUserToAccessGroup()
    async addUserToAccessGroup(
        @BodyUUID('uuid') uuid: string,
        @BodyUUID('userUUID') userUUID: string,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.accessService.addUserToAccessGroup(uuid, userUUID);
    }

    @Get('searchAccessGroup')
    @LoggedIn()
    async search(
        @QueryOptionalString('search') search: string,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QueryOptionalBoolean('personal') personal: boolean,
        @QueryOptionalBoolean('creator') creator: boolean,
        @QueryOptionalBoolean('member') member: boolean,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.accessService.searchAccessGroup(
            search,
            personal,
            creator,
            member,
            user,
            skip,
            take,
        );
    }

    @Post('addAccessGroupToProject')
    @CanWriteProject()
    async addAccessGroupToProject(
        @BodyUUID('uuid') uuid: string,
        @BodyUUID('accessGroupUUID') accessGroupUUID: string,
        @BodyAccessGroupRights('rights') rights: AccessGroupRights,
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
