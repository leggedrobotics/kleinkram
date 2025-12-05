import { ActionWorkersDto } from '@kleinkram/api-dto';
import { WorkerEntity } from '@kleinkram/backend-common/entities/worker/worker.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Repository } from 'typeorm';

@Injectable()
export class WorkerService {
    constructor(
        @InjectRepository(WorkerEntity)
        private workerRepository: Repository<WorkerEntity>,
    ) {}

    async findAll(): Promise<ActionWorkersDto> {
        const workers = await this.workerRepository.find();

        // deduplicate workers by hostname get last seen worker
        // eslint-disable-next-line unicorn/no-array-reduce
        const workerMap = workers.reduce(
            (accumulator: Record<string, WorkerEntity>, worker) => {
                if (
                    !accumulator[worker.hostname] ||
                    accumulator[worker.hostname].lastSeen < worker.lastSeen
                ) {
                    accumulator[worker.hostname] = worker;
                }
                return accumulator;
            },
            {},
        );

        const count = Object.keys(workerMap).length;
        const result = {
            count,
            data: Object.values(workerMap).map((worker) => ({
                ...worker,
                gpuModel: worker.gpuModel ?? null,
            })),
            skip: 0,
            take: count,
        };

        const dto = plainToInstance(ActionWorkersDto, result);
        validateSync(dto, { whitelist: true, forbidNonWhitelisted: false });
        return dto;
    }
}
