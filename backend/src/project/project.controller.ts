import {
    Body,
    Controller,
    Delete,
    Get,
    HttpException,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProject } from './entities/create-project.dto';
import {
    AdminOnly,
    LoggedIn,
    CanReadProject,
    CanReadProjectByName,
    CanWriteProject,
    CanCreateProject,
    CanDeleteProject,
} from '../auth/roles.decorator';
import { addJWTUser, JWTUser } from 'src/auth/paramDecorator';

@Controller('project')
export class ProjectController {
    constructor(private readonly projectService: ProjectService) {}

    @Get()
    @LoggedIn()
    async allProjects() {
        return this.projectService.findAll();
    }

    @Get('one')
    @CanReadProject()
    async getProjectById(@Query('uuid') uuid: string) {
        return this.projectService.findOne(uuid);
    }

    @Put('update')
    @CanWriteProject()
    async updateProject(
        @Query('uuid') uuid: string,
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
    async getProjectByName(@Query('name') name: string) {
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
    async deleteProject(@Query('uuid') uuid: string) {
        return this.projectService.deleteProject(uuid);
    }
}
