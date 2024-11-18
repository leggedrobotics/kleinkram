import { Controller, Get } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { LoggedIn } from '../auth/roles.decorator';
import { ApiOperation } from '@nestjs/swagger';

@Controller('worker')
export class WorkerController {
    constructor(private readonly workerService: WorkerService) {}

    @Get('all')
    @LoggedIn()
    @ApiOperation({
        summary: 'Get all workers',
        description: `Get all workers including their hardware information.`,
    })
    async allWorkers() {
        return this.workerService.findAll();
    }
}
