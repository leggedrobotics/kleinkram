import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProject } from './entities/create-project.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoggedInUserGuard } from '../auth/roles.guard';
import { LoggedIn } from '../auth/roles.decorator';

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

  @Post('create')
  @LoggedIn()
  async createProject(@Body() dto: CreateProject) {
    return this.projectService.create(dto);
  }

  @Get('byName')
  @LoggedIn()
  async getProjectByName(@Query('name') name: string) {
    return this.projectService.findOneByName(name);
  }
}
