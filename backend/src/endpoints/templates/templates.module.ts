import ActionTemplateEntity from '@kleinkram/backend-common/entities/action/action-template.entity';
import ActionEntity from '@kleinkram/backend-common/entities/action/action.entity';
import UserEntity from '@kleinkram/backend-common/entities/user/user.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateService } from '../../services/template.service';
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
export class TemplatesModule {}
