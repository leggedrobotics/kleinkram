import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RunService } from './run.service';
import { CreateRun } from './entities/create-run.dto';
import { LoggedIn } from '../auth/roles.decorator';

@Controller('run')
export class RunController {
  constructor(private readonly runService: RunService) {}

  @Post('create')
  @LoggedIn()
  async createRun(@Body() createRun: CreateRun) {
    return this.runService.create(createRun);
  }

  @Get('filtered/:projectUUID')
  @LoggedIn()
  async filteredRuns(@Param('projectUUID') projectUUID: string) {
    return this.runService.findRunByProject(projectUUID);
  }

  @Get('all')
  @LoggedIn()
  async allRuns() {
    return this.runService.findAll();
  }

  @Get('byName')
  @LoggedIn()
  async getRunByName(@Query('name') name: string) {
    return this.runService.findOneByName(name);
  }

  @Get('filteredByProjectName/:projectName')
  @LoggedIn()
  async filteredByProjectName(@Param('projectName') projectName: string) {
    return this.runService.filteredByProjectName(projectName);
  }
}
