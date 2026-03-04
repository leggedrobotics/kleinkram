import { Module } from '@nestjs/common';
import { FaviconController } from './favicon.controller';
import { HealthController } from './health.controller';

@Module({
    controllers: [HealthController, FaviconController],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class HealthModule {}
