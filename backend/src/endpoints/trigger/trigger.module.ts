import { TriggerService } from '@/services/trigger.service';
import {
    ActionTemplateEntity,
    ActionTriggerEntity,
    MissionEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { ActionDispatcherModule } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.module';
import { Module } from '@nestjs/common';
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
    ],
    controllers: [TriggerController, HookController],
    providers: [TriggerService],
    exports: [TriggerService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TriggerModule {}
