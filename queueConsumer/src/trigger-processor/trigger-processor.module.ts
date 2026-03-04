import {
    ActionTemplateEntity,
    ActionTriggerEntity,
    FileEntity,
    MissionEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { ActionDispatcherModule } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TriggerQueueProcessorProvider } from './trigger-queue-processor.provider';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ActionTriggerEntity,
            ActionTemplateEntity,
            MissionEntity,
            UserEntity,
            FileEntity,
        ]),
        ActionDispatcherModule,
    ],
    providers: [TriggerQueueProcessorProvider],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TriggerProcessorModule {}
