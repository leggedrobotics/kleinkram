import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Worker from '@common/entities/worker/worker.entity';
import { WorkersDto } from '@common/api/types/Workers.dto';

@Injectable()
export class WorkerService {
    constructor(
        @InjectRepository(Worker) private workerRepository: Repository<Worker>,
    ) {}

    async findAll(): Promise<WorkersDto> {
        const workers = await this.workerRepository.find();

        // deduplicate workers by hostname get last seen worker
        const workerMap = workers.reduce((acc, worker) => {
            if (
                !acc[worker.hostname] ||
                acc[worker.hostname].lastSeen < worker.lastSeen
            ) {
                acc[worker.hostname] = worker;
            }
            return acc;
        }, {});

        const count = Object.keys(workerMap).length;
        return {
            count,
            workers: Object.values(workerMap),
        };
    }
}
