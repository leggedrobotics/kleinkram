import { Controller, Get } from '@nestjs/common';
import { WorkerService } from '../../services/worker.service';
import { LoggedIn } from '../auth/roles.decorator';
import { ApiOperation } from '@nestjs/swagger';
import { ApiOkResponse } from '../../decarators';
import { ActionWorkersDto } from '@common/api/types/ActionWorkersDto';

@Controller('worker')
export class WorkerController {
    constructor(private readonly workerService: WorkerService) {}

    @Get('all')
    @LoggedIn()
    @ApiOperation({
        summary: 'Get all workers',
        description: `Get all workers including their hardware information.`,
    })
    @ApiOkResponse({
        description: 'List of workers',
        type: ActionWorkersDto,
    })
    async allWorkers(): Promise<ActionWorkersDto> {
        return this.workerService.findAll();
    }
}
