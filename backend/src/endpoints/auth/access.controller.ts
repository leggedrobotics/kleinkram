import { ApiOkResponse, ApiResponse, OutputDto } from '@/decorators';
import { AccessService } from '@/services/access.service';
import {
    AccessGroupDto,
    AccessGroupsDto,
    AddAccessGroupToProjectDto,
    AddUserToAccessGroupDto,
    AddUserToProjectDto,
    CreateAccessGroupDto,
    DeleteAccessGroupResponseDto,
    GetFilteredAccessGroupsDto,
    GroupMembershipDto,
    ProjectDto,
    RemoveAccessGroupFromProjectResponseDto,
    RemoveUsersFromAccessGroupDto,
    SetAccessGroupUserExpirationDto,
} from '@kleinkram/api-dto';
import { AccessGroupEntity } from '@kleinkram/backend-common';
import {
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { EntityNotFoundError } from 'typeorm';
import { ParameterUuid as ParameterUID } from '../../validation/parameter-decorators';
import { AddUser, AuthHeader } from './parameter-decorator';
import {
    CanCreate,
    CanDeleteProject,
    CanEditGroup,
    CanWriteProject,
    UserOnly,
} from './roles.decorator';

@Controller('access')
export class AccessController {
    constructor(private readonly accessService: AccessService) {}

    @ApiOperation({
        summary: 'Get filtered AccessGroups',
        description:
            'Joins: memberships, memberships.user, project_access, project_access.project, creator',
    })
    @ApiOkResponse({
        description: 'Returns the AccessGroups',
        type: AccessGroupsDto,
    })
    @Get()
    @CanCreate()
    @UserOnly()
    async search(
        @Query() query: GetFilteredAccessGroupsDto,
    ): Promise<AccessGroupsDto> {
        return this.accessService.searchAccessGroup(
            query.search,
            query.type,
            query.skip,
            query.take,
        );
    }

    @Get(':uuid')
    @UserOnly()
    @ApiOkResponse({
        type: AccessGroupDto,
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
        @ParameterUID('uuid', 'AccessGroup UUID') uuid: string,
        @AddUser() user: AuthHeader,
    ): Promise<AccessGroupDto> {
        return await this.accessService
            .getAccessGroup(uuid, user.user.uuid)
            .catch((error: unknown) => {
                if (error instanceof EntityNotFoundError) {
                    throw new NotFoundException('AccessGroup not found');
                }
                throw error;
            });
    }

    @Post()
    @CanCreate()
    @ApiOkResponse({
        type: AccessGroupDto,
        description: 'Returns the created AccessGroup',
    })
    @ApiOperation({
        summary: 'Create AccessGroup',
        description:
            'Creates a new AccessGroup with the given name and the user as creator',
    })
    async createAccessGroup(
        @Body() body: CreateAccessGroupDto,
        @AddUser() user: AuthHeader,
    ): Promise<AccessGroupDto> {
        const accessGroup = await this.accessService.createAccessGroup(
            body.name,
            user,
        );
        return this.accessService.getAccessGroup(
            accessGroup.uuid,
            user.user.uuid,
        );
    }

    @ApiOperation({
        summary: 'Add User to Project',
        description: 'Adds a user to a project with the given rights.',
    })
    @ApiResponse({
        status: 200,
        type: ProjectDto,
        description: 'The Project the user was added to.',
    })
    @ApiResponse({
        status: 409,
        type: ConflictException,
        description: 'User cannot grant the rights.',
    })
    @Post('addUserToProject')
    @CanWriteProject()
    @OutputDto(ProjectDto)
    async addUserToProject(
        @Body() body: AddUserToProjectDto,
        @AddUser() requestUser: AuthHeader,
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
        type: AccessGroupEntity,
        description: 'The Access Group the user was added to.',
    })
    @ApiResponse({
        status: 404,
        type: NotFoundException,
        description: 'Access Group not found.',
    })
    @Post(':uuid/users')
    @CanEditGroup()
    @OutputDto(AccessGroupDto)
    async addUserToAccessGroup(
        @ParameterUID('uuid', 'UUID of AccessGroup') uuid: string,
        @Body() body: AddUserToAccessGroupDto,
        @AddUser() requestUser: AuthHeader,
    ) {
        await this.accessService
            .addUserToAccessGroup(uuid, body.userUUID)
            .catch((error: unknown) => {
                if (error instanceof EntityNotFoundError) {
                    throw new NotFoundException('AccessGroup not found');
                }
                throw error;
            });
        return this.accessService.getAccessGroup(uuid, requestUser.user.uuid);
    }

    @ApiOperation({
        summary: 'Remove User from Access Group',
    })
    @ApiResponse({
        status: 200,
        type: AccessGroupDto,
        description: 'The Access Group the user was removed from.',
    })
    @Delete(':uuid/users/:userUuid')
    @CanEditGroup()
    @OutputDto(AccessGroupDto)
    async removeUserFromAccessGroup(
        @ParameterUID('uuid', 'UUID of AccessGroup') uuid: string,
        @ParameterUID('userUuid', 'UUID of User to remove') userUuid: string,
        @AddUser() requestUser: AuthHeader,
    ) {
        await this.accessService.removeUsersFromAccessGroup(uuid, [userUuid]);
        return this.accessService.getAccessGroup(uuid, requestUser.user.uuid);
    }

    @ApiOperation({
        summary: 'Bulk Remove Users from Access Group',
    })
    @ApiResponse({
        status: 200,
        type: AccessGroupDto,
        description: 'The Access Group the users were removed from.',
    })
    @Delete(':uuid/users')
    @CanEditGroup()
    @OutputDto(AccessGroupDto)
    async removeUsersFromAccessGroup(
        @ParameterUID('uuid', 'UUID of AccessGroup') uuid: string,
        @Body() body: RemoveUsersFromAccessGroupDto,
        @AddUser() requestUser: AuthHeader,
    ) {
        await this.accessService.removeUsersFromAccessGroup(
            uuid,
            body.userUuids,
        );
        return this.accessService.getAccessGroup(uuid, requestUser.user.uuid);
    }

    @ApiOperation({
        summary: 'Add Access Group to Project',
        description: 'Adds an Access Group to a Project with the given rights.',
    })
    @ApiOkResponse({
        description: 'Returns the Project',
        type: ProjectDto,
    })
    @Post(':uuid/projects/:projectUuid')
    @CanWriteProject()
    @OutputDto(ProjectDto)
    async addAccessGroupToProject(
        @ParameterUID('uuid', 'UUID of AccessGroup') uuid: string,
        @ParameterUID('projectUuid', 'UUID of Project') projectUuid: string,
        @Body() body: AddAccessGroupToProjectDto,
        @AddUser() user: AuthHeader,
    ): Promise<ProjectDto> {
        return this.accessService.addAccessGroupToProject(
            projectUuid,
            uuid,
            body.rights,
            user,
        );
    }

    @Delete(':uuid/projects/:projectUuid')
    @CanDeleteProject()
    @ApiResponse({
        status: 204,
        type: RemoveAccessGroupFromProjectResponseDto,
        description: 'The Access Group was removed from the Project.',
    })
    @OutputDto(RemoveAccessGroupFromProjectResponseDto)
    async removeAccessGroupFromProject(
        @ParameterUID('uuid', 'UUID of AccessGroup') uuid: string,
        @ParameterUID('projectUuid', 'UUID of Project') projectUuid: string,
        @AddUser() user: AuthHeader,
    ): Promise<void> {
        return this.accessService.removeAccessGroupFromProject(
            projectUuid,
            uuid,
            user,
        );
    }

    @Delete(':uuid')
    @CanEditGroup()
    @ApiResponse({
        status: 204,
        type: DeleteAccessGroupResponseDto,
        description: 'The Access Group was deleted.',
    })
    @OutputDto(DeleteAccessGroupResponseDto)
    async deleteAccessGroup(
        @ParameterUID('uuid', 'UUID of AccessGroup to be deleted') uuid: string,
    ) {
        return this.accessService.deleteAccessGroup(uuid);
    }

    @Put(':uuid/users/:userUuid/expiration')
    @CanEditGroup()
    @ApiOkResponse({
        description: 'Returns the updated GroupMembership',
        type: GroupMembershipDto,
    })
    @ApiOperation({
        summary: 'Set expiration date for user in AccessGroup',
        description: 'Sets the expiration date for the user in the AccessGroup',
    })
    async setExpireDate(
        @ParameterUID('uuid', 'UUID of AccessGroup') uuid: string,
        @ParameterUID('userUuid', 'UUID of User to set expiration')
        userUuid: string,
        @Body() body: SetAccessGroupUserExpirationDto,
    ): Promise<GroupMembershipDto> {
        return this.accessService.setExpireDate(
            uuid,
            userUuid,
            body.expireDate,
        );
    }
}
