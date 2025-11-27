import ActionTemplateEntity from '@common/entities/action/action-template.entity';
import ActionEntity from '@common/entities/action/action.entity';
import UserEntity from '@common/entities/user/user.entity';
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
