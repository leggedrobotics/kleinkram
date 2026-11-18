import { ApiOkResponse } from '@/decorators';
import { WorkerService } from '@/services/worker.service';
import { ActionWorkersDto } from '@kleinkram/api-dto';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { CanCreate } from '../auth/roles.decorator';

@Controller('workers')
export class WorkerController {
    constructor(private readonly workerService: WorkerService) {}

    @Get()
    @CanCreate()
    @ApiOperation({
        summary: 'Get all workers',
        description: `Get all workers including their hardware information. Only users who may create projects (admins and members of an affiliation group) can list the workers.`,
    })
    @ApiOkResponse({
        description: 'List of workers',
        type: ActionWorkersDto,
    })
    async allWorkers(): Promise<ActionWorkersDto> {
        return this.workerService.findAll();
    }
}
