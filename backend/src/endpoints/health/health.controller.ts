import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OutputDto } from '../../decarators';

@ApiTags('health')
@Controller('api/health')
export class HealthController {
    @Get()
    @OutputDto(null)
    check() {
        return { status: 'ok' };
    }
}
