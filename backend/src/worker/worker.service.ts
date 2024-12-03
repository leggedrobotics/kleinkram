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
        const workerMap = workers.reduce((accumulator, worker) => {
            if (
                !accumulator[worker.hostname] ||
                accumulator[worker.hostname].lastSeen < worker.lastSeen
            ) {
                accumulator[worker.hostname] = worker;
            }
            return accumulator;
        }, {});

        const count = Object.keys(workerMap).length;
        return {
            count,
            workers: Object.values(workerMap),
        };
    }
}
