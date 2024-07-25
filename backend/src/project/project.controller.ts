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
import { AccessGroupRights } from '@common/enum';

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

    @Post('addTagType')
    @CanWriteProject()
    async addTagType(
        @Query('uuid') uuid: string,
        @Query('tagTypeUUID') tagTypeUUID: string,
    ) {
        return this.projectService.addTagType(uuid, tagTypeUUID);
    }

    @Post('removeTagType')
    @CanWriteProject()
    async removeTagType(
        @Query('uuid') uuid: string,
        @Query('tagTypeUUID') tagTypeUUID: string,
    ) {
        return this.projectService.removeTagType(uuid, tagTypeUUID);
    }

    @Get('canAddAccessGroup')
    @LoggedIn()
    async canAddAccessGroup(
        @Query('uuid') uuid: string,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.projectService.canAddAccessGroup(uuid, user);
    }

    @Post('addUser')
    @CanWriteProject()
    async addUser(
        @Body('uuid') uuid: string,
        @Body('userUUID') userUUID: string,
        @Body('rights') rights: AccessGroupRights,
        @addJWTUser() user?: JWTUser,
    ) {
        return this.projectService.addUser(uuid, userUUID, rights);
    }
}
