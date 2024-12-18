import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Worker from '@common/entities/worker/worker.entity';
import { WorkerController } from './worker.controller';
import { WorkerService } from '../../services/worker.service';

@Module({
    imports: [TypeOrmModule.forFeature([Worker])],
    controllers: [WorkerController],
    providers: [WorkerService],
    exports: [WorkerService],
})
export class WorkerModule {}
