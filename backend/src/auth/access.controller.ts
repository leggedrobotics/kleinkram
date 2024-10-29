import { Controller, Delete, Get, Post } from '@nestjs/common';
import { AccessService } from './access.service';
import {
    CanCreate,
    CanDeleteProject,
    CanReadProject,
    CanWriteProject,
    IsAccessGroupCreator,
    IsAccessGroupCreatorByProjectAccess,
    UserOnly,
} from './roles.decorator';
import { addUser, AuthRes } from './paramDecorator';
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
    @UserOnly()
    async getAccessGroup(@QueryString('uuid') uuid: string) {
        return this.accessService.getAccessGroup(uuid);
    }

    @Post('create')
    @CanCreate()
    async createAccessGroup(
        @BodyName('name') name: string,
        @addUser() user: AuthRes,
    ) {
        return this.accessService.createAccessGroup(name, user);
    }

    @Get('canAddAccessGroupToProject')
    @UserOnly()
    async canAddAccessGroup(
        @QueryUUID('uuid') uuid: string,
        @addUser() user?: AuthRes,
    ) {
        return this.accessService.hasProjectRights(uuid, user);
    }

    @Post('addUserToProject')
    @CanWriteProject()
    async addUserToProject(
        @BodyUUID('uuid') uuid: string,
        @BodyUUID('userUUID') userUUID: string,
        @BodyAccessGroupRights('rights') rights: AccessGroupRights,
        @addUser() requestUser?: AuthRes,
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
    ) {
        return this.accessService.addUserToAccessGroup(uuid, userUUID);
    }

    @Post('removeUserFromAccessGroup')
    @IsAccessGroupCreator()
    async removeUserFromAccessGroup(
        @BodyUUID('uuid') uuid: string,
        @BodyUUID('userUUID') userUUID: string,
    ) {
        return this.accessService.removeUserFromAccessGroup(uuid, userUUID);
    }

    @Get('filtered')
    @UserOnly()
    @CanCreate()
    async search(
        @QueryOptionalString('search') search: string,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QueryOptionalBoolean('personal') personal: boolean,
        @QueryOptionalBoolean('creator') creator: boolean,
        @QueryOptionalBoolean('member') member: boolean,
        @addUser() user?: AuthRes,
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
        @addUser() user?: AuthRes,
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
        @addUser() user?: AuthRes,
    ) {
        return this.accessService.removeAccessGroupFromProject(
            uuid,
            accessGroupUUID,
            user,
        );
    }

    @Delete(':uuid')
    @IsAccessGroupCreator()
    async deleteAccessGroup(@ParamUUID('uuid') uuid: string) {
        return this.accessService.deleteAccessGroup(uuid);
    }

    @Get('projectAccess')
    @CanReadProject()
    async getProjectAccess(
        @QueryString('uuid') uuid: string,
        @QueryString('projectAccessUUID') projectAccessUUID: string,
    ) {
        return this.accessService.getProjectAccess(uuid, projectAccessUUID);
    }

    @Post('updateProjectAccess')
    @CanWriteProject()
    @IsAccessGroupCreatorByProjectAccess()
    async updateProjectAccess(
        @BodyUUID('uuid') uuid: string,
        @BodyUUID('projectAccessUUID') projectAccessUUID: string,
        @BodyAccessGroupRights('rights') rights: AccessGroupRights,
        @addUser() user?: AuthRes,
    ) {
        return this.accessService.updateProjectAccess(
            uuid,
            projectAccessUUID,
            rights,
            user,
        );
    }
}
