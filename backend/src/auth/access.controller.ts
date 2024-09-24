import { Controller, Delete, Get, Post } from '@nestjs/common';
import { AccessService } from './access.service';
import {
    IsAccessGroupCreator,
    CanCreate,
    CanReadProject,
    CanWriteProject,
    IsAccessGroupCreatorByProjectAccess,
    LoggedIn,
    CanDeleteProject,
} from './roles.decorator';
import { addUser, JWTUser } from './paramDecorator';
import { AccessGroupRights } from '@common/enum';
import {
    BodyAccessGroupRights,
    BodyName,
    BodyUUID,
} from '../validation/bodyDecorators';
import {
    QueryOptionalBoolean,
    QueryOptionalString,
    QuerySkip,
    QueryString,
    QueryUUID,
} from '../validation/queryDecorators';
import { ParamUUID } from '../validation/paramDecorators';

@Controller('access')
export class AccessController {
    constructor(private readonly accessService: AccessService) {}

    @Get('one')
    @LoggedIn()
    async getAccessGroup(
        @QueryString('uuid') uuid: string,
        @addUser() user?: JWTUser,
    ) {
        return this.accessService.getAccessGroup(uuid, user);
    }

    @Post('create')
    @CanCreate()
    async createAccessGroup(
        @BodyName('name') name: string,
        @addUser() user: JWTUser,
    ) {
        return this.accessService.createAccessGroup(name, user);
    }

    @Get('canAddAccessGroupToProject')
    @LoggedIn()
    async canAddAccessGroup(
        @QueryUUID('uuid') uuid: string,
        @addUser() user?: JWTUser,
    ) {
        return this.accessService.hasProjectRights(uuid, user);
    }

    @Post('addUserToProject')
    @CanWriteProject()
    async addUserToProject(
        @BodyUUID('uuid') uuid: string,
        @BodyUUID('userUUID') userUUID: string,
        @BodyAccessGroupRights('rights') rights: AccessGroupRights,
        @addUser() requestUser?: JWTUser,
    ) {
        return this.accessService.addUserToProject(
            uuid,
            userUUID,
            rights,
            requestUser,
        );
    }

    @Post('addUserToAccessGroup')
    @IsAccessGroupCreator()
    async addUserToAccessGroup(
        @BodyUUID('uuid') uuid: string,
        @BodyUUID('userUUID') userUUID: string,
        @addUser() user?: JWTUser,
    ) {
        return this.accessService.addUserToAccessGroup(uuid, userUUID);
    }

    @Post('removeUserFromAccessGroup')
    @IsAccessGroupCreator()
    async removeUserFromAccessGroup(
        @BodyUUID('uuid') uuid: string,
        @BodyUUID('userUUID') userUUID: string,
        @addUser() user?: JWTUser,
    ) {
        return this.accessService.removeUserFromAccessGroup(uuid, userUUID);
    }

    @Get('filtered')
    @LoggedIn()
    async search(
        @QueryOptionalString('search') search: string,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QueryOptionalBoolean('personal') personal: boolean,
        @QueryOptionalBoolean('creator') creator: boolean,
        @QueryOptionalBoolean('member') member: boolean,
        @addUser() user?: JWTUser,
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
        @addUser() user?: JWTUser,
    ) {
        return this.accessService.addAccessGroupToProject(
            uuid,
            accessGroupUUID,
            rights,
            user,
        );
    }

    @Post('removeAccessGroupFromProject')
    @CanDeleteProject()
    async removeAccessGroupFromProject(
        @BodyUUID('uuid') uuid: string,
        @BodyUUID('accessGroupUUID') accessGroupUUID: string,
        @addUser() user?: JWTUser,
    ) {
        return this.accessService.removeAccessGroupFromProject(
            uuid,
            accessGroupUUID,
            user,
        );
    }

    @Delete(':uuid')
    @IsAccessGroupCreator()
    async deleteAccessGroup(
        @ParamUUID('uuid') uuid: string,
        @addUser() user?: JWTUser,
    ) {
        return this.accessService.deleteAccessGroup(uuid);
    }

    @Get('projectAccess')
    @CanReadProject()
    async getProjectAccess(
        @QueryString('uuid') uuid: string,
        @QueryString('projectAccessUUID') projectAccessUUID: string,
        @addUser() user?: JWTUser,
    ) {
        return this.accessService.getProjectAccess(
            uuid,
            projectAccessUUID,
            user,
        );
    }

    @Post('updateProjectAccess')
    @CanWriteProject()
    @IsAccessGroupCreatorByProjectAccess()
    async updateProjectAccess(
        @BodyUUID('uuid') uuid: string,
        @BodyUUID('projectAccessUUID') projectAccessUUID: string,
        @BodyAccessGroupRights('rights') rights: AccessGroupRights,
        @addUser() user?: JWTUser,
    ) {
        return this.accessService.updateProjectAccess(
            uuid,
            projectAccessUUID,
            rights,
            user,
        );
    }
}
