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
    AdminOnly,
    CanCreateProject,
    CanDeleteProject,
    CanReadProject,
    CanReadProjectByName,
    CanWriteProject,
    LoggedIn,
} from '../auth/roles.decorator';
import {
    QuerySkip,
    QueryString,
    QueryTake,
    QueryUUID,
} from '../validation/queryDecorators';
import { addJWTUser, JWTUser } from '../auth/paramDecorator';

@Controller('project')
export class ProjectController {
    constructor(private readonly projectService: ProjectService) {}

    @Get()
    @LoggedIn()
    async allProjects(@addJWTUser() user?: JWTUser) {
        return this.projectService.findAll(user);
    }

    @Get('one')
    @CanReadProject()
    async getProjectById(@QueryUUID('uuid') uuid: string) {
        return this.projectService.findOne(uuid);
    }

    @Put('update')
    @CanWriteProject()
    async updateProject(
        @QueryUUID('uuid') uuid: string,
        @Body() dto: CreateProject,
    ) {
        return this.projectService.update(uuid, dto);
    }

    @Post('create')
    @CanCreateProject()
    async createProject(
        @Body() dto: CreateProject,
        @addJWTUser() user?: JWTUser,
    ) {
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

    @Delete('clear')
    @AdminOnly()
    async clearProjects() {
        return this.projectService.clearProjects();
    }

    @Delete('delete')
    @CanDeleteProject()
    async deleteProject(@QueryUUID('uuid') uuid: string) {
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
}
