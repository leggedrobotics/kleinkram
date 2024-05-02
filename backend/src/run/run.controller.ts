import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RunService } from './run.service';
import { CreateRun } from './entities/create-run.dto';

@Controller('run')
export class RunController {
  constructor(private readonly runService: RunService) {}

  @Post('create')
  async createRun(@Body() createRun: CreateRun) {
    return this.runService.create(createRun);
  }

  @Get('filtered/:projectUUID')
  async filteredRuns(@Param('projectUUID') projectUUID: string) {
    return this.runService.findRunByProject(projectUUID);
  }

  @Get('all')
  async allRuns() {
    return this.runService.findAll();
  }

  @Get('filteredByProjectName/:projectName')
  async filteredByProjectName(@Param('projectName') projectName: string) {
    return this.runService.filteredByProjectName(projectName);
  }
}
