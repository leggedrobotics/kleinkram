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
    CanEditGroup,
    CanReadProject,
    CanWriteProject,
    IsAccessGroupCreator,
    UserOnly,
} from './roles.decorator';
import { AddUser, AuthRes } from './paramDecorator';
import {
    QueryOptionalAccessGroupType,
    QueryOptionalString,
    QuerySkip,
    QueryUUID,
} from '../validation/queryDecorators';
import { ParamUUID as ParameterUID } from '../validation/paramDecorators';
import { CreateAccessGroupDto } from './dto/CreateAccessGroup.dto';
import { AddUserToProjectDto } from './dto/AddUserToProject.dto';
import { AddUserToAccessGroupDto } from './dto/AddUserToAccessGroup.dto';
import { AddAccessGroupToProjectDto } from './dto/AddAccessGroupToProject.dto';
import { RemoveAccessGroupFromProjectDto } from './dto/RemoveAccessGroupFromProject.dto';
import { SetAccessGroupUserExpirationDto } from './dto/SetAccessGroupUserExpiration.dto';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { ApiOkResponse, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EntityNotFoundError } from 'typeorm';
import Project from '@common/entities/project/project.entity';
import {
    AccessGroupsDto,
    GroupMembershipDto,
} from '@common/api/types/User.dto';
import { AccessGroupType } from '@common/frontend_shared/enum';
import { ProjectDto } from '@common/api/types/Project.dto';

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
        @AddUser() user: AuthRes,
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
        @AddUser() user: AuthRes,
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
        @AddUser() requestUser: AuthRes,
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
        @QueryOptionalString('search', 'Searchkey for accessgroup name')
        search: string,
        @QuerySkip('skip') skip: number,
        @QuerySkip('take') take: number,
        @AddUser() user: AuthRes,
        @QueryOptionalAccessGroupType('type', 'Type of AccessGroup')
        type?: AccessGroupType,
    ): Promise<AccessGroupsDto> {
        return this.accessService.searchAccessGroup(
            search,
            type,
            user,
            skip,
            take,
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
    async addAccessGroupToProject(
        @Body() body: AddAccessGroupToProjectDto,
        @AddUser() user: AuthRes,
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
    async removeAccessGroupFromProject(
        @Body() body: RemoveAccessGroupFromProjectDto,
        @AddUser() user: AuthRes,
    ): Promise<void> {
        return this.accessService.removeAccessGroupFromProject(
            body.uuid,
            body.accessGroupUUID,
            user,
        );
    }

    @Delete(':uuid')
    @IsAccessGroupCreator()
    async deleteAccessGroup(
        @ParameterUID('uuid', 'UUID of AccessGroup to be deleted') uuid: string,
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
        @AddUser() user: AuthRes,
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
