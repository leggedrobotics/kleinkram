import { Body, Controller, Post } from '@nestjs/common';
import { RunService } from './run.service';
import { CreateRun } from './entities/create-run.dto';

@Controller('run')
export class RunController {
  constructor(private readonly runService: RunService) {}

  @Post('create')
  async createRun(@Body() createRun: CreateRun) {
    return this.runService.create(createRun);
  }
}
