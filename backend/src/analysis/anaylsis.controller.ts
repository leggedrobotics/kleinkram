import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AnalysisService } from './anaylsis.service';
import {
  AnalysisRunQuery,
  SubmitAnalysisRun,
} from './entities/submit_analysis.dto';
import { QueueService } from '../queue/queue.service';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly queueService: QueueService,
  ) {}

  @Post('submit')
  async createProject(@Body() dto: SubmitAnalysisRun) {
    // TODO: validate input: similar to the frontend, we should validate the input
    // to ensure that the user has provided the necessary information to create a new project.

    // TODO: generate UUID for the run, return that to the frontend for tracking
    const analysis_run = await this.analysisService.submit(dto);
    await this.queueService.addAnalysisQueue(analysis_run.uuid);
  }

  @Get('list')
  async list(@Query() dto: AnalysisRunQuery) {
    return this.analysisService.list(dto.projectUUID, dto.run_uuids);
  }
}
