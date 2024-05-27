import { Module } from '@nestjs/common';
import { AnalysisController } from './anaylsis.controller';
import { AnalysisService } from './anaylsis.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import AnalysisRun from './entities/analysis.entity';
import { QueueModule } from '../queue/queue.module';

@Module({
    imports: [TypeOrmModule.forFeature([AnalysisRun]), QueueModule],
    providers: [AnalysisService],
    exports: [AnalysisService],
    controllers: [AnalysisController],
})
export class AnalysisModule {}
