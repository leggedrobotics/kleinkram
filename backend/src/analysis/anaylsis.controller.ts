import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { AnalysisService } from './anaylsis.service';
import {
    AnalysisRunDetailsQuery,
    AnalysisRunQuery,
    SubmitAnalysisRun,
} from './entities/submit_analysis.dto';
import { QueueService } from '../queue/queue.service';
import { AdminOnly } from '../auth/roles.decorator';

@Controller('analysis')
export class AnalysisController {
    constructor(
        private readonly analysisService: AnalysisService,
        private readonly queueService: QueueService,
    ) {}

    @Post('submit')
    async createAnalysisRun(@Body() dto: SubmitAnalysisRun) {
        // TODO: validate input: similar to the frontend, we should validate the input
        // to ensure that the user has provided the necessary information to create a new project.

        // TODO: generate UUID for the run, return that to the frontend for tracking
        const analysis_run = await this.analysisService.submit(dto);
        await this.queueService.addAnalysisQueue(analysis_run.uuid);
    }

    @Get('list')
    async list(@Query() dto: AnalysisRunQuery) {
        return this.analysisService.list(dto.run_uuids);
    }

    @Get('details')
    async details(@Query() dto: AnalysisRunDetailsQuery) {
        return this.analysisService.details(dto.analysis_uuid);
    }

    @Delete('clear')
    @AdminOnly()
    async clear() {
        return this.analysisService.clear();
    }
}
