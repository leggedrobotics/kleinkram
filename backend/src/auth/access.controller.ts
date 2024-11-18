import {
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Post,
} from '@nestjs/common';
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
import { AddAccessGroupToProjectDto } from './dto/AddAccessGroupToProject.dto';
import { RemoveAccessGroupFromProjectDto } from './dto/RemoveAccessGroupFromProject.dto';
import { SetAccessGroupUserExpirationDto } from './dto/SetAccessGroupUserExpiration.dto';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EntityNotFoundError } from 'typeorm';
import Project from '@common/entities/project/project.entity';
import { CountedAccessGroups } from './dto/CountedAccessGroups.dto';

@Controller('access')
export class AccessController {
    constructor(private readonly accessService: AccessService) {}

    @Get('one')
    @UserOnly()
    @ApiResponse({
        status: 200,
        type: AccessGroup,
        description: 'Returns the AccessGroup',
    })
    @ApiResponse({
        status: 404,
        type: NotFoundException,
        description: 'Access Group not found',
    })
    @ApiOperation({
        summary: 'Get AccessGroup by UUID',
        description:
            'Joins: memberships, memberships.user, project_access, project_access.project,  project_access.project.creator',
    })
    async getAccessGroup(
        @QueryUUID('uuid', 'AccessGroup UUID') uuid: string,
    ): Promise<AccessGroup> {
        return await this.accessService.getAccessGroup(uuid).catch((e) => {
            if (e instanceof EntityNotFoundError) {
                throw new NotFoundException('AccessGroup not found');
            }
            throw e;
        });
    }

    @Post('create')
    @CanCreate()
    @ApiResponse({
        status: 200,
        type: AccessGroup,
        description: 'Returns the created AccessGroup',
    })
    @ApiOperation({
        summary: 'Create AccessGroup',
        description:
            'Creates a new AccessGroup with the given name and the user as creator',
    })
    async createAccessGroup(
        @Body() body: CreateAccessGroupDto,
        @addUser() user: AuthRes,
    ) {
        return this.accessService.createAccessGroup(body.name, user);
    }

    @ApiResponse({
        status: 200,
        type: Boolean,
        description: 'User can add AccessGroup to Project',
    })
    @ApiOperation({
        summary: 'Can add an AccessGroup to a Project',
        description:
            'Checks if the user has the rights to add an AccessGroup to a Project',
    })
    @Get('canAddAccessGroupToProject')
    @UserOnly()
    async canAddAccessGroup(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @addUser() user?: AuthRes,
    ) {
        return this.accessService.hasProjectRights(uuid, user);
    }

    @ApiOperation({
        summary: 'Add User to Project',
        description: 'Adds a user to a project with the given rights.',
    })
    @ApiResponse({
        status: 200,
        type: Project,
        description: 'The Project the user was added to.',
    })
    @ApiResponse({
        status: 409,
        type: ConflictException,
        description: 'User cannot grant the rights.',
    })
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

    @ApiOperation({
        summary: 'Add User to Access Group',
    })
    @ApiResponse({
        status: 200,
        type: AccessGroup,
        description: 'The Access Group the user was added to.',
    })
    @ApiResponse({
        status: 404,
        type: NotFoundException,
        description: 'Access Group not found.',
    })
    @Post('addUserToAccessGroup')
    @IsAccessGroupCreator()
    async addUserToAccessGroup(@Body() body: AddUserToAccessGroupDto) {
        return await this.accessService
            .addUserToAccessGroup(body.uuid, body.userUUID)
            .catch((e) => {
                if (e instanceof EntityNotFoundError) {
                    throw new NotFoundException('AccessGroup not found');
                }
                throw e;
            });
    }

    @ApiOperation({
        summary: 'Remove User from Access Group',
    })
    @ApiResponse({
        status: 200,
        type: AccessGroup,
        description: 'The Access Group the user was removed from.',
    })
    @Post('removeUserFromAccessGroup')
    @IsAccessGroupCreator()
    async removeUserFromAccessGroup(@Body() body: AddUserToAccessGroupDto) {
        return this.accessService.removeUserFromAccessGroup(
            body.uuid,
            body.userUUID,
        );
    }

    @ApiResponse({
        status: 200,
        type: CountedAccessGroups,
        description: 'Returns the AccessGroups',
    })
    @ApiOperation({
        summary: 'Get filtered AccessGroups',
        description:
            'Joins: memberships, memberships.user, project_access, project_access.project, creator',
    })
    @Get('filtered')
    @CanCreate()
    @UserOnly()
    async search(
        @QueryOptionalString('search', 'Searchkey for accessgroup name')
        search: string,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @QueryOptionalBoolean('personal', 'Only Personal Access Groups')
        personal: boolean,
        @QueryOptionalBoolean('creator', 'Only Access Groups created by user')
        creator: boolean,
        @QueryOptionalBoolean(
            'member',
            'Only Access Groups the user is member of',
        )
        member: boolean,
        @addUser() user?: AuthRes,
    ): Promise<CountedAccessGroups> {
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

    @ApiOperation({
        summary: 'Add Access Group to Project',
        description: 'Adds an Access Group to a Project with the given rights.',
    })
    @Post('addAccessGroupToProject')
    @CanWriteProject()
    async addAccessGroupToProject(
        @Body() body: AddAccessGroupToProjectDto,
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
        @Body() body: RemoveAccessGroupFromProjectDto,
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
    async deleteAccessGroup(
        @ParamUUID('uuid', 'UUID of AccessGroup to be deleted') uuid: string,
    ) {
        return this.accessService.deleteAccessGroup(uuid);
    }

    @Get('projectAccess')
    @CanReadProject()
    async getProjectAccess(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryUUID('projectAccessUUID', 'ProjectAccess UUID')
        projectAccessUUID: string,
    ) {
        return this.accessService.getProjectAccess(uuid, projectAccessUUID);
    }

    @Post('updateProjectAccess')
    @CanWriteProject()
    async updateProjectAccess(
        @Body() body: AddAccessGroupToProjectDto,
        @addUser() user?: AuthRes,
    ) {
        return this.accessService.updateProjectAccess(
            body.uuid,
            body.accessGroupUUID,
            body.rights,
            user,
        );
    }

    @Post('setExpireDate')
    @IsAccessGroupCreatorByAccessGroupUser()
    async setExpireDate(@Body() body: SetAccessGroupUserExpirationDto) {
        return this.accessService.setExpireDate(body.aguUUID, body.expireDate);
    }
}
