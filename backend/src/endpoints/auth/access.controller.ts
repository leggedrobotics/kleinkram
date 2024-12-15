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
import { AccessService } from '../../services/access.service';
import {
    CanCreate,
    CanDeleteProject,
    CanEditGroup,
    CanReadProject,
    CanWriteProject,
    IsAccessGroupCreator,
    UserOnly,
} from './roles.decorator';
import { QueryUUID } from '../../validation/queryDecorators';
import { ParamUUID as ParameterUID } from '../../validation/paramDecorators';
import { CreateAccessGroupDto } from '@common/api/types/create-access-group.dto';
import { AddUserToProjectDto } from '@common/api/types/add-user-project.dto';
import { AddUserToAccessGroupDto } from '@common/api/types/add-user-access-group.dto';
import { AddAccessGroupToProjectDto } from '@common/api/types/add-access-group-project.dto';
import { RemoveAccessGroupFromProjectDto } from '@common/api/types/RemoveAccessGroupFromProject.dto';
import { SetAccessGroupUserExpirationDto } from '@common/api/types/SetAccessGroupUserExpiration.dto';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { ApiOkResponse, ApiResponse, OutputDto } from '../../decarators';
import { EntityNotFoundError } from 'typeorm';
import Project from '@common/entities/project/project.entity';
import { GroupMembershipDto } from '@common/api/types/user.dto';
import { GetFilteredAccessGroupsDto } from '@common/api/types/access-control/get-filtered-access-groups.dto';
import { AccessGroupsDto } from '@common/api/types/access-control/access-groups.dto';
import { ProjectAccessDto } from '@common/api/types/access-control/project-access.dto';
import { ProjectWithMissionsDto } from '@common/api/types/project/project-with-missions.dto';
import { AddUser, AuthHeader } from './param-decorator';
import { ApiOperation } from '@nestjs/swagger';

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
        return await this.accessService
            .getAccessGroup(uuid)
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
        status: 200,
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
    @OutputDto(null) // TODO: type API response
    async canAddAccessGroup(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @AddUser() user: AuthHeader,
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
    @OutputDto(null) // TODO: type API response
    async addUserToAccessGroup(@Body() body: AddUserToAccessGroupDto) {
        return await this.accessService
            .addUserToAccessGroup(body.uuid, body.userUUID)
            .catch((error: unknown) => {
                if (error instanceof EntityNotFoundError) {
                    throw new NotFoundException('AccessGroup not found');
                }
                throw error;
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
    @OutputDto(null) // TODO: type API response
    async removeUserFromAccessGroup(@Body() body: AddUserToAccessGroupDto) {
        return this.accessService.removeUserFromAccessGroup(
            body.uuid,
            body.userUUID,
        );
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
        type: ProjectWithMissionsDto,
    })
    @Post('addAccessGroupToProject')
    @CanWriteProject()
    async addAccessGroupToProject(
        @Body() body: AddAccessGroupToProjectDto,
        @AddUser() user: AuthHeader,
    ): Promise<ProjectWithMissionsDto> {
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
        @AddUser() user: AuthHeader,
    ): Promise<void> {
        return this.accessService.removeAccessGroupFromProject(
            body.uuid,
            body.accessGroupUUID,
            user,
        );
    }

    @Delete(':uuid')
    @IsAccessGroupCreator()
    @OutputDto(null) // TODO: type API response
    async deleteAccessGroup(
        @ParameterUID('uuid', 'UUID of AccessGroup to be deleted') uuid: string,
    ) {
        return this.accessService.deleteAccessGroup(uuid);
    }

    @Get('projectAccess')
    @CanReadProject()
    @ApiOkResponse({
        description: 'Returns the ProjectAccess',
        type: ProjectAccessDto,
    })
    async getProjectAccess(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
    ): Promise<ProjectAccessDto> {
        return this.accessService.getProjectAccess(uuid);
    }

    @Post('updateProjectAccess')
    @CanWriteProject()
    @OutputDto(null) // TODO: type API response
    async updateProjectAccess(
        @Body() body: AddAccessGroupToProjectDto,
        @AddUser() user: AuthHeader,
    ) {
        return this.accessService.updateProjectAccess(
            body.uuid,
            body.accessGroupUUID,
            body.rights,
            user,
        );
    }

    @Post('setExpireDate')
    @CanEditGroup()
    async setExpireDate(
        @Body() body: SetAccessGroupUserExpirationDto,
    ): Promise<GroupMembershipDto> {
        return this.accessService.setExpireDate(body.aguUUID, body.expireDate);
    }
}
