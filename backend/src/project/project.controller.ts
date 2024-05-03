import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProject } from './entities/create-project.dto';

@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  async allProjects() {
    return this.projectService.findAll();
  }

  @Get('one')
  async getProjectById(@Query('uuid') uuid: string) {
    return this.projectService.findOne(uuid);
  }

  @Post('create')
  async createProject(@Body() dto: CreateProject) {
    return this.projectService.create(dto);
  }

  @Get('byName')
  async getProjectByName(@Query('name') name: string) {
    return this.projectService.findOneByName(name);
  }
}
