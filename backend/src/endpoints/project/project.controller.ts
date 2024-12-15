import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ProjectService } from '../../services/project.service';
import { CreateProject } from '@common/api/types/create-project.dto';
import {
    CanCreate,
    CanDeleteProject,
    CanReadProject,
    CanReadProjectByName,
    CanWriteProject,
    LoggedIn,
    UserOnly,
} from '../auth/roles.decorator';
import {
    QueryProjectSearchParameters as QueryProjectSearchParameter,
    QuerySkip,
    QuerySortBy,
    QuerySortDirection,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../../validation/query-decorators';
import { ParameterUuid as ParameterUID } from '../../validation/param-decorators';
import { BodyUUIDArray } from '../../validation/body-decorators';
import { ApiOperation } from '@nestjs/swagger';
import { ApiOkResponse, ApiResponse } from '../../decarators';
import { DefaultRights } from '@common/api/types/access-control/default-rights';
import { ResentProjectsDto } from '@common/api/types/project/recent-projects.dto';
import { ProjectsDto } from '@common/api/types/project/projects.dto';
import { ProjectWithMissionsDto } from '@common/api/types/project/project-with-missions.dto';
import { AddUser, AuthHeader } from '../auth/parameter-decorator';
import { DeleteProjectResponseDto } from '@common/api/types/delete-project-response.dto';
import { UpdateTagTypesDto } from '@common/api/types/update-tag-types.dto';
import { RemoveTagTypeDto } from '@common/api/types/remove-tag-type.dto';
import { AddTagTypeDto } from '@common/api/types/add-tag-type.dto';

@Controller('project')
export class ProjectController {
    constructor(private readonly projectService: ProjectService) {}

    @Get('filtered')
    @UserOnly()
    @ApiOperation({
        summary: 'Get all projects',
        description:
            'Get all projects with optional search, filter, and pagination options',
    })
    @ApiOkResponse({
        description: 'Returns the most recent projects',
        type: ProjectsDto,
    })
    async allProjects(
        @AddUser()
        authHeader: AuthHeader,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QuerySortBy('sortBy') sortBy: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QueryProjectSearchParameter('searchParams', 'search name and creator')
        searchParameters: Map<string, string>,
    ): Promise<ProjectsDto> {
        return this.projectService.findAll(
            authHeader.user,
            skip,
            take,
            sortBy,
            sortDirection,
            searchParameters,
        );
    }

    @Get('recent')
    @UserOnly()
    @ApiOperation({
        summary: 'Get recent projects',
        description:
            'Get the most recent projects the current user has access to',
    })
    @ApiOkResponse({
        description: 'Returns the most recent projects',
        type: ResentProjectsDto,
    })
    async getRecentProjects(
        @QueryTake('take') take: number,
        @AddUser() user: AuthHeader,
    ): Promise<ResentProjectsDto> {
        const projects = await this.projectService.getRecentProjects(
            take,
            user.user,
        );

        return {
            data: projects,
            count: projects.length,
            skip: 0,
            take: projects.length,
        };
    }

    @Get('one')
    @CanReadProject()
    @ApiOkResponse({
        description: 'Returns the project',
        type: ProjectWithMissionsDto,
    })
    async getProjectById(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
    ): Promise<ProjectWithMissionsDto> {
        return this.projectService.findOne(uuid);
    }

    @Put(':uuid')
    @CanWriteProject()
    @ApiOkResponse({
        description: 'Returns the updated project',
        type: ProjectWithMissionsDto,
    })
    async updateProject(
        @ParameterUID('uuid') uuid: string,
        @Body() dto: CreateProject,
    ): Promise<ProjectWithMissionsDto> {
        return this.projectService.update(uuid, dto);
    }

    @Post('create')
    @CanCreate()
    @ApiOkResponse({
        description: 'Returns the updated project',
        type: ProjectWithMissionsDto,
    })
    async createProject(
        @Body() dto: CreateProject,
        @AddUser() user: AuthHeader,
    ): Promise<ProjectWithMissionsDto> {
        return this.projectService.create(dto, user);
    }

    @Get('byName')
    @CanReadProjectByName()
    @ApiOkResponse({
        description: 'Returns the project',
        type: ProjectWithMissionsDto,
    })
    async getProjectByName(
        @QueryString('name', 'Project Name') name: string,
    ): Promise<ProjectWithMissionsDto> {
        return await this.projectService.findOneByName(name);
    }

    @Delete(':uuid')
    @CanDeleteProject()
    @ApiResponse({
        description: 'Project deleted',
        status: 204,
        type: DeleteProjectResponseDto,
    })
    async deleteProject(@ParameterUID('uuid') uuid: string): Promise<void> {
        return this.projectService.deleteProject(uuid);
    }

    @Post('addTagType')
    @CanWriteProject()
    @ApiOkResponse({
        description: 'Empty response',
        type: AddTagTypeDto,
    })
    async addTagType(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryUUID('tagTypeUUID', 'TagType UUID') tagTypeUUID: string,
    ): Promise<AddTagTypeDto> {
        await this.projectService.addTagType(uuid, tagTypeUUID);
        return {};
    }

    @Post('removeTagType')
    @CanWriteProject()
    @ApiOkResponse({
        type: RemoveTagTypeDto,
        description: 'Empty response',
    })
    async removeTagType(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryUUID('tagTypeUUID', 'TagType UUID') tagTypeUUID: string,
    ): Promise<RemoveTagTypeDto> {
        await this.projectService.removeTagType(uuid, tagTypeUUID);
        return {};
    }

    @Post('updateTagTypes')
    @CanWriteProject()
    @ApiOkResponse({
        description: 'Empty response',
        type: UpdateTagTypesDto,
    })
    async updateTagTypes(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @BodyUUIDArray('tagTypeUUIDs', 'List of Tagtype UUID to set')
        tagTypeUUIDs: string[],
    ): Promise<UpdateTagTypesDto> {
        await this.projectService.updateTagTypes(uuid, tagTypeUUIDs);
        return {};
    }

    @Get('getDefaultRights')
    @LoggedIn()
    @ApiOperation({
        summary: 'Get default rights',
        description: `Get the default rights for a project, the default rights 
        are the rights that should be assigned to a new project upon creation`,
    })
    @ApiOkResponse({
        description: 'Returns the default rights for a project',
        type: DefaultRights,
    })
    async getDefaultRights(
        @AddUser() user: AuthHeader,
    ): Promise<DefaultRights> {
        return this.projectService.getDefaultRights(user);
    }
}
