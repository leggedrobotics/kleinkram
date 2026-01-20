import { TriggerService } from '@/services/trigger.service';
import {
    ActionTemplateEntity,
    ActionTriggerEntity,
    MissionEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { redis } from '@kleinkram/backend-common/consts';
import { ActionDispatcherModule } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.module';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HookController } from './hook.controller';
import { TriggerController } from './trigger.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ActionTriggerEntity,
            ActionTemplateEntity,
            MissionEntity,
            UserEntity,
        ]),
        ActionDispatcherModule,
        ThrottlerModule.forRoot({
            throttlers: [{ name: 'default', limit: 10, ttl: 60_000 }],
            storage: new ThrottlerStorageRedisService(redis),
        }),
    ],
    controllers: [TriggerController, HookController],
    providers: [TriggerService],
    exports: [TriggerService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TriggerModule {}
