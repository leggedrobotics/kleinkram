import Worker from '@common/entities/worker/worker.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerService } from '../../services/worker.service';
import { WorkerController } from './worker.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Worker])],
    controllers: [WorkerController],
    providers: [WorkerService],
    exports: [WorkerService],
})
export class WorkerModule {}
