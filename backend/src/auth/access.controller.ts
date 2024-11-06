import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { AccessService } from './access.service';
import {
    CanCreate,
    CanDeleteProject,
    CanReadProject,
    CanWriteProject,
    IsAccessGroupCreator,
    IsAccessGroupCreatorByAccessGroupUser,
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
    QueryUUID,
} from '../validation/queryDecorators';
import { ParamUUID } from '../validation/paramDecorators';
import { CreateAccessGroupDto } from './dto/CreateAccessGroup.dto';
import { AddUserToProjectDto } from './dto/AddUserToProject.dto';
import { AddUserToAccessGroupDto } from './dto/AddUserToAccessGroup.dto';
import { AddAccessGroupToProject } from './dto/AddAccessGroupToProject';
import { RemoveAccessGroupFromProject } from './dto/RemoveAccessGroupFromProject';

@Controller('access')
export class AccessController {
    constructor(private readonly accessService: AccessService) {}

    @Get('one')
    @UserOnly()
    async getAccessGroup(@QueryUUID('uuid','AccessGroup UUID') uuid: string) {
        return this.accessService.getAccessGroup(uuid);
    }

    @Post('create')
    @CanCreate()
    async createAccessGroup(
        @Body() body: CreateAccessGroupDto,
        @addUser() user: AuthRes,
    ) {
        return this.accessService.createAccessGroup(body.name, user);
    }

    @Get('canAddAccessGroupToProject')
    @UserOnly()
    async canAddAccessGroup(
        @QueryUUID('uuid', 'Project UUID' ) uuid: string,
        @addUser() user?: AuthRes,
    ) {
        return this.accessService.hasProjectRights(uuid, user);
    }

    @Post('addUserToProject')
    @CanWriteProject()
    async addUserToProject(
        @Body() body: AddUserToProjectDto,
        @addUser() requestUser?: AuthRes,
    ) {
        return this.accessService.addUserToProject(
            body.uuid,
            body.userUUID,
            body.rights,
            requestUser,
        );
    }

    @Post('addUserToAccessGroup')
    @IsAccessGroupCreator()
    async addUserToAccessGroup(
        @Body() body: AddUserToAccessGroupDto
    ) {
        return this.accessService.addUserToAccessGroup(body.uuid, body.userUUID);
    }

    @Post('removeUserFromAccessGroup')
    @IsAccessGroupCreator()
    async removeUserFromAccessGroup(
        @Body() body: AddUserToProjectDto,
    ) {
        return this.accessService.removeUserFromAccessGroup(body.uuid, body.userUUID);
    }

    @Get('filtered')
    @UserOnly()
    @CanCreate()
    async search(
        @QueryOptionalString('search', 'Searchkey for accessgroup name') search: string,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QueryOptionalBoolean('personal', 'Only Personal Access Groups') personal: boolean,
        @QueryOptionalBoolean('creator', 'Only Access Groups created by user') creator: boolean,
        @QueryOptionalBoolean('member', 'Only Access Groups the user is member of') member: boolean,
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
        @Body() body: AddAccessGroupToProject,
        @addUser() user?: AuthRes,
    ) {
        return this.accessService.addAccessGroupToProject(
            body.uuid,
            body.accessGroupUUID,
            body.rights,
            user,
        );
    }

    @Post('removeAccessGroupFromProject')
    @CanDeleteProject()
    async removeAccessGroupFromProject(
        @Body() body: RemoveAccessGroupFromProject,
        @addUser() user?: AuthRes,
    ) {
        return this.accessService.removeAccessGroupFromProject(
            body.uuid,
            body.accessGroupUUID,
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
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryUUID('projectAccessUUID','ProjectAccess UUID') projectAccessUUID: string,
    ) {
        return this.accessService.getProjectAccess(uuid, projectAccessUUID);
    }

    @Post('updateProjectAccess')
    @CanWriteProject()
    async updateProjectAccess(
        @BodyUUID('uuid', 'Project UUID') uuid: string,
        @BodyUUID('groupUuid', '?? UUID') groupUuid: string,
        @BodyAccessGroupRights('rights', 'User Rights') rights: AccessGroupRights,
        @addUser() user?: AuthRes,
    ) {
        return this.accessService.updateProjectAccess(
            uuid,
            groupUuid,
            rights,
            user,
        );
    }

    @Post('setExpireDate')
    @IsAccessGroupCreatorByAccessGroupUser()
    async setExpireDate(
        @BodyUUID('aguUUID', 'AccessGroupUser UUID') aguUUID: string,
        @Body('expireDate') expireDate: Date,
    ) {
        return this.accessService.setExpireDate(aguUUID, expireDate);
    }
}
