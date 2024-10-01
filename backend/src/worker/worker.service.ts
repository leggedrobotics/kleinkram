import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Worker from '@common/entities/worker/worker.entity';

@Injectable()
export class WorkerService {
    constructor(
        @InjectRepository(Worker) private workerRepository: Repository<Worker>,
    ) {}

    async findAll() {
        return this.workerRepository.findAndCount();
    }
}
