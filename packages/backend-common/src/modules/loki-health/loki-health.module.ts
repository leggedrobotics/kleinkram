import { Module } from '@nestjs/common';
import { LokiHealthService } from './loki-health.service';

@Module({
    providers: [LokiHealthService],
    exports: [LokiHealthService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class LokiHealthModule {}
