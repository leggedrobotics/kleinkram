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
    QueryOptionalBoolean,
    QueryProjectSearchParam,
    QuerySortBy,
    QuerySkip,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import { addUser, AuthRes } from '../auth/paramDecorator';
import { ParamUUID } from '../validation/paramDecorators';
import Project from '@common/entities/project/project.entity';
import { AccessGroupRights } from '@common/enum';
import { ApiQuery } from '@nestjs/swagger';

@Controller('project')
export class ProjectController {
    constructor(private readonly projectService: ProjectService) {}

    @Get('filtered')
    @ApiQuery({
        name: 'skip',
        required: true,
        description: 'Number of items to skip',
        type: Number,
    })
    @ApiQuery({
        name: 'take',
        required: true,
        description: 'Number of items to take',
        type: Number,
    })
    @ApiQuery({
        name: 'sortBy',
        required: false,
        description: 'Sort by',
        type: String,
    })
    @UserOnly()
    async allProjects(
        @addUser()
        user: AuthRes,
        @QuerySkip('skip') skip: number,
        @QueryTake('take') take: number,
        @QuerySortBy('sortBy') sortBy?: string,
        @QueryOptionalBoolean('descending') descending?: boolean,
        @QueryProjectSearchParam('searchParams')
        searchParams?: Map<string, string>,
    ) {
        return this.projectService.findAll(
            user,
            skip,
            take,
            sortBy,
            descending,
            searchParams,
        );
    }

    @Get('one')
    @CanReadProject()
    async getProjectById(@QueryUUID('uuid') uuid: string): Promise<Project> {
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
    async createProject(@Body() dto: CreateProject, @addUser() user?: AuthRes) {
        return this.projectService.create(dto, user);
    }

    @Get('byName')
    @CanReadProjectByName()
    async getProjectByName(@QueryString('name') name: string) {
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
        @QueryUUID('uuid') uuid: string,
        @QueryString('tagTypeUUID') tagTypeUUID: string,
    ) {
        return this.projectService.addTagType(uuid, tagTypeUUID);
    }

    @Post('removeTagType')
    @CanWriteProject()
    async removeTagType(
        @QueryUUID('uuid') uuid: string,
        @QueryString('tagTypeUUID') tagTypeUUID: string,
    ) {
        return this.projectService.removeTagType(uuid, tagTypeUUID);
    }

    @Post('updateTagTypes')
    @CanWriteProject()
    async updateTagTypes(
        @QueryUUID('uuid') uuid: string,
        @Body('tagTypeUUIDs') tagTypeUUIDs: string[],
    ) {
        return this.projectService.updateTagTypes(uuid, tagTypeUUIDs);
    }

    @Get('getDefaultRights')
    @LoggedIn()
    async getDefaultRights(
        @addUser() user: AuthRes,
    ): Promise<
        { name: string; accessGroupUUID: string; rights: AccessGroupRights }[]
    > {
        return this.projectService.getDefaultRights(user);
    }
}
