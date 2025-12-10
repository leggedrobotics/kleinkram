import { TemplateService } from '@/services/template.service';
import { ActionTemplateEntity } from '@kleinkram/backend-common/entities/action/action-template.entity';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplatesController } from './templates.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ActionTemplateEntity,
            ActionEntity,
            UserEntity,
        ]),
    ],
    providers: [TemplateService],
    controllers: [TemplatesController],
    exports: [TemplateService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TemplatesModule {}
