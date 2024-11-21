import {
    Body,
    Controller,
    Delete,
    Get,
    HttpException,
    Post,
    Put,
} from '@nestjs/common';
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
    QueryProjectSearchParam,
    QuerySkip,
    QuerySortBy,
    QuerySortDirection,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import { AddUser, AuthRes } from '../auth/paramDecorator';
import { ParamUUID } from '../validation/paramDecorators';
import Project from '@common/entities/project/project.entity';
import { BodyUUIDArray } from '../validation/bodyDecorators';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { DefaultRightsDto } from '@common/api/types/DefaultRights.dto';
import { ResentProjectsDto } from '@common/api/types/RecentProjects.dto';

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
    async allProjects(
        @AddUser()
        authRes: AuthRes,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QuerySortBy('sortBy') sortBy: string,
        @QuerySortDirection('sortDirection') sortDirection: 'ASC' | 'DESC',
        @QueryProjectSearchParam('searchParams', 'search name and creator')
        searchParams: Map<string, string>,
    ) {
        return this.projectService.findAll(
            authRes.user,
            skip,
            take,
            sortBy,
            sortDirection,
            searchParams,
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
        type: [ResentProjectsDto],
    })
    async getRecentProjects(
        @QueryTake('take') take: number,
        @AddUser() user: AuthRes,
    ): Promise<ResentProjectsDto> {
        return {
            projects: await this.projectService.getRecentProjects(
                take,
                user.user,
            ),
        };
    }

    @Get('one')
    @CanReadProject()
    async getProjectById(
        @QueryUUID('uuid', 'Project UUID') uuid: string,
    ): Promise<Project> {
        return this.projectService.findOne(uuid);
    }

    @Put(':uuid')
    @CanWriteProject()
    async updateProject(
        @ParamUUID('uuid') uuid: string,
        @Body() dto: CreateProject,
    ) {
        return this.projectService.update(uuid, dto);
    }

    @Post('create')
    @CanCreate()
    async createProject(@Body() dto: CreateProject, @AddUser() user: AuthRes) {
        return this.projectService.create(dto, user);
    }

    @Get('byName')
    @CanReadProjectByName()
    async getProjectByName(@QueryString('name', 'Project Name') name: string) {
        const project = await this.projectService.findOneByName(name);
        if (!project) {
            throw new HttpException('Project not found', 404);
        }
        return project;
    }

    @Delete(':uuid')
    @CanDeleteProject()
    async deleteProject(@ParamUUID('uuid') uuid: string) {
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
        type: DefaultRightsDto,
    })
    async getDefaultRights(
        @AddUser() user: AuthRes,
    ): Promise<DefaultRightsDto> {
        return this.projectService.getDefaultRights(user);
    }
}
