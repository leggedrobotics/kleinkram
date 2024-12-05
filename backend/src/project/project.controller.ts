import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProject } from './entities/create-project.dto';
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
    QueryProjectSearchParam as QueryProjectSearchParameter,
    QuerySkip,
    QuerySortBy,
    QuerySortDirection,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import { AddUser, AuthRes } from '../auth/paramDecorator';
import { ParamUUID as ParameterUID } from '../validation/paramDecorators';
import { BodyUUIDArray } from '../validation/bodyDecorators';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiOkResponse } from '../decarators';
import { DefaultRights } from '@common/api/types/access-control/default-rights';
import { ResentProjectsDto } from '@common/api/types/RecentProjects.dto';
import { ProjectDto, ProjectsDto } from '@common/api/types/project/project.dto';

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
        authRes: AuthRes,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QuerySortBy('sortBy') sortBy: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QueryProjectSearchParameter('searchParams', 'search name and creator')
        searchParameters: Map<string, string>,
    ): Promise<ProjectsDto> {
        return this.projectService.findAll(
            authRes.user,
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
        @AddUser() user: AuthRes,
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
        type: ProjectDto,
    })
    async getProjectById(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
    ): Promise<ProjectDto> {
        return this.projectService.findOne(uuid);
    }

    @Put(':uuid')
    @CanWriteProject()
    @ApiOkResponse({
        description: 'Returns the updated project',
        type: ProjectDto,
    })
    async updateProject(
        @ParameterUID('uuid') uuid: string,
        @Body() dto: CreateProject,
    ): Promise<ProjectDto> {
        return this.projectService.update(uuid, dto);
    }

    @Post('create')
    @CanCreate()
    @ApiOkResponse({
        description: 'Returns the updated project',
        type: ProjectDto,
    })
    async createProject(
        @Body() dto: CreateProject,
        @AddUser() user: AuthRes,
    ): Promise<ProjectDto> {
        return this.projectService.create(dto, user);
    }

    @Get('byName')
    @CanReadProjectByName()
    @ApiOkResponse({
        description: 'Returns the project',
        type: ProjectDto,
    })
    async getProjectByName(
        @QueryString('name', 'Project Name') name: string,
    ): Promise<ProjectDto> {
        return await this.projectService.findOneByName(name);
    }

    @Delete(':uuid')
    @CanDeleteProject()
    @ApiResponse({
        description: 'Project deleted',
        status: 204,
    })
    async deleteProject(@ParameterUID('uuid') uuid: string) {
        return this.projectService.deleteProject(uuid);
    }

    @Post('addTagType')
    @CanWriteProject()
    async addTagType(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryUUID('tagTypeUUID', 'TagType UUID') tagTypeUUID: string,
    ) {
        return this.projectService.addTagType(uuid, tagTypeUUID);
    }

    @Post('removeTagType')
    @CanWriteProject()
    async removeTagType(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @QueryUUID('tagTypeUUID', 'TagType UUID') tagTypeUUID: string,
    ) {
        return this.projectService.removeTagType(uuid, tagTypeUUID);
    }

    @Post('updateTagTypes')
    @CanWriteProject()
    async updateTagTypes(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
        @BodyUUIDArray('tagTypeUUIDs', 'List of Tagtype UUID to set')
        tagTypeUUIDs: string[],
    ) {
        return this.projectService.updateTagTypes(uuid, tagTypeUUIDs);
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
    async getDefaultRights(@AddUser() user: AuthRes): Promise<DefaultRights> {
        return this.projectService.getDefaultRights(user);
    }
}
