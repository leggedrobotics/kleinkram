import { SystemSettingsDto, UpdateSystemSettingsDto } from '@kleinkram/api-dto';
import { SystemSettingEntity } from '@kleinkram/backend-common/entities/system/system-setting.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** Values used while no admin has changed a setting. */
const DEFAULTS: SystemSettingsDto = {
    foxglovePreviewEnabled: true,
};

type SettingKey = keyof SystemSettingsDto;

@Injectable()
export class SystemSettingsService {
    constructor(
        @InjectRepository(SystemSettingEntity)
        private readonly settingRepository: Repository<SystemSettingEntity>,
    ) {}

    async get(): Promise<SystemSettingsDto> {
        const rows = await this.settingRepository.find();
        const settings: SystemSettingsDto = {
            foxglovePreviewEnabled: DEFAULTS.foxglovePreviewEnabled,
        };
        for (const row of rows) {
            if (
                row.key === 'foxglovePreviewEnabled' &&
                typeof row.value === 'boolean'
            ) {
                settings.foxglovePreviewEnabled = row.value;
            }
        }
        return settings;
    }

    async update(changes: UpdateSystemSettingsDto): Promise<SystemSettingsDto> {
        const entries = (Object.keys(DEFAULTS) as SettingKey[])
            .filter((key) => changes[key] !== undefined)
            .map((key) => ({ key, value: changes[key] }));
        if (entries.length > 0) {
            await this.settingRepository.upsert(entries, ['key']);
        }
        return this.get();
    }
}
