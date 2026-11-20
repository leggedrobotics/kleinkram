import { SystemSettingsService } from '@/services/system-settings.service';
import { SystemSettingEntity } from '@kleinkram/backend-common/entities/system/system-setting.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSettingsController } from './system-settings.controller';

@Module({
    imports: [TypeOrmModule.forFeature([SystemSettingEntity])],
    controllers: [SystemSettingsController],
    providers: [SystemSettingsService],
    exports: [SystemSettingsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SystemSettingsModule {}
