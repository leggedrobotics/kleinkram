import { ApiOkResponse, ApiResponse, OutputDto } from '@/decorators';
import { AccessService } from '@/services/access.service';
import { QueryUUID } from '@/validation/query-decorators';
import {
    AccessGroupDto,
    AccessGroupsDto,
    AddAccessGroupToProjectDto,
    AddUserToAccessGroupDto,
    AddUserToProjectDto,
    CreateAccessGroupDto,
    GetFilteredAccessGroupsDto,
    GroupMembershipDto,
    ProjectDto,
    RemoveAccessGroupFromProjectDto,
    RemoveUsersFromAccessGroupDto,
    SetAccessGroupUserExpirationDto,
} from '@kleinkram/api-dto';
import { AccessGroupEntity } from '@kleinkram/backend-common';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import {
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Post,
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

    @Get('one')
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
        @QueryUUID('uuid', 'AccessGroup UUID') uuid: string,
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

    @Post('create')
    @CanCreate()
    @ApiOkResponse({
        type: CreateAccessGroupDto,
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
    ): Promise<CreateAccessGroupDto> {
        const accessGroup = await this.accessService.createAccessGroup(
            body.name,
            user,
        );
        return {
            name: accessGroup.name,
        };
    }

    @ApiOperation({
        summary: 'Add User to Project',
        description: 'Adds a user to a project with the given rights.',
    })
    @ApiResponse({
        status: 200,
        type: ProjectEntity,
        description: 'The Project the user was added to.',
    })
    @ApiResponse({
        status: 409,
        type: ConflictException,
        description: 'User cannot grant the rights.',
    })
    @Post('addUserToProject')
    @CanWriteProject()
    @OutputDto(null) // TODO: type API response
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
    @Post('addUserToAccessGroup')
    @CanEditGroup()
    @OutputDto(AccessGroupDto)
    async addUserToAccessGroup(
        @Body() body: AddUserToAccessGroupDto,
        @AddUser() requestUser: AuthHeader,
    ) {
        await this.accessService
            .addUserToAccessGroup(body.uuid, body.userUUID)
            .catch((error: unknown) => {
                if (error instanceof EntityNotFoundError) {
                    throw new NotFoundException('AccessGroup not found');
                }
                throw error;
            });
        return this.accessService.getAccessGroup(
            body.uuid,
            requestUser.user.uuid,
        );
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
        summary: 'Get filtered AccessGroups',
        description:
            'Joins: memberships, memberships.user, project_access, project_access.project, creator',
    })
    @ApiOkResponse({
        description: 'Returns the AccessGroups',
        type: AccessGroupsDto,
    })
    @Get('filtered')
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

    @ApiOperation({
        summary: 'Add Access Group to Project',
        description: 'Adds an Access Group to a Project with the given rights.',
    })
    @ApiOkResponse({
        description: 'Returns the Project',
        type: ProjectDto,
    })
    @Post('addAccessGroupToProject')
    @CanWriteProject()
    @OutputDto(ProjectDto)
    async addAccessGroupToProject(
        @Body() body: AddAccessGroupToProjectDto,
        @AddUser() user: AuthHeader,
    ): Promise<ProjectDto> {
        return this.accessService.addAccessGroupToProject(
            body.uuid,
            body.accessGroupUUID,
            body.rights,
            user,
        );
    }

    @Post('removeAccessGroupFromProject')
    @CanDeleteProject()
    @OutputDto(null) // TODO: type API response
    async removeAccessGroupFromProject(
        @Body() body: RemoveAccessGroupFromProjectDto,
        @AddUser() user: AuthHeader,
    ): Promise<void> {
        return this.accessService.removeAccessGroupFromProject(
            body.uuid,
            body.accessGroupUUID,
            user,
        );
    }

    @Delete(':uuid')
    @CanEditGroup()
    @OutputDto(null) // TODO: type API response
    async deleteAccessGroup(
        @ParameterUID('uuid', 'UUID of AccessGroup to be deleted') uuid: string,
    ) {
        return this.accessService.deleteAccessGroup(uuid);
    }

    @Post('setExpireDate')
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
        @Body() body: SetAccessGroupUserExpirationDto,
    ): Promise<GroupMembershipDto> {
        return this.accessService.setExpireDate(
            body.uuid,
            body.userUuid,
            body.expireDate,
        );
    }
}
