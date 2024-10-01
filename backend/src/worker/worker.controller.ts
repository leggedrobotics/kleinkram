import { Controller, Get } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { LoggedIn } from '../auth/roles.decorator';

@Controller('worker')
export class WorkerController {
    constructor(private readonly workerService: WorkerService) {}

    @Get('all')
    @LoggedIn()
    async allWorkers() {
        return this.workerService.findAll();
    }
}
