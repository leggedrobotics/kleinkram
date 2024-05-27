import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProject } from './entities/create-project.dto';
import { AdminOnly, LoggedIn } from '../auth/roles.decorator';
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
  @LoggedIn()
  async getProjectById(@Query('uuid') uuid: string) {
    return this.projectService.findOne(uuid);
  }

  @Put('update')
  @LoggedIn()
  async updateProject(@Query('uuid') uuid: string, @Body() dto: CreateProject) {
    return this.projectService.update(uuid, dto);
  }

  @Post('create')
  @LoggedIn()
  async createProject(
    @Body() dto: CreateProject,
    @addJWTUser() user?: JWTUser,
  ) {
    return this.projectService.create(dto, user);
  }

  @Get('byName')
  @LoggedIn()
  async getProjectByName(@Query('name') name: string) {
    return this.projectService.findOneByName(name);
  }

  @Delete('clear')
  @AdminOnly()
  async clearProjects() {
    return this.projectService.clearProjects();
  }

  @Delete('delete')
  @LoggedIn()
  async deleteProject(@Query('uuid') uuid: string) {
    return this.projectService.deleteProject(uuid);
  }
}
