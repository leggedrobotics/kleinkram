import { Controller, Get } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { LoggedIn } from '../auth/roles.decorator';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { WorkersDto } from '@common/api/types/Workers.dto';

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
        type: WorkersDto,
    })
    async allWorkers(): Promise<WorkersDto> {
        return this.workerService.findAll();
    }
}
