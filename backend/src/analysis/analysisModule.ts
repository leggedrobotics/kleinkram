import { Module } from '@nestjs/common';
import { AnalysisController } from './anaylsis.controller';
import { AnalysisService } from './anaylsis.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import AnalysisRun from './entities/analysis.entity';
import { QueueModule } from '../queue/queue.module';
import Token from '../auth/entities/token.entity';
import User from '../user/entities/user.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([AnalysisRun, Token, User]),
        QueueModule,
    ],
    providers: [AnalysisService],
    exports: [AnalysisService],
    controllers: [AnalysisController],
})
export class AnalysisModule {}
