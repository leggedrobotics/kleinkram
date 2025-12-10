import { OutputDto } from '@/decorators';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('api/health')
export class HealthController {
    @Get()
    @OutputDto(null)
    check() {
        return { status: 'ok' };
    }
}
