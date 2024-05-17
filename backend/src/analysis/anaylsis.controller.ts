import { Body, Controller, Post } from '@nestjs/common';
import { AnalysisService } from './anaylsis.service';
import { SubmitAnalysisRun } from './entities/submit_analysis.dto';
import { QueueService } from '../queue/queue.service';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly queueService: QueueService,
  ) {}

  @Post('submit')
  async createProject(@Body() dto: SubmitAnalysisRun) {
    await this.analysisService.submit(dto.uuid);
    await this.queueService.addAnalysisQueue(dto.uuid);
  }
}
