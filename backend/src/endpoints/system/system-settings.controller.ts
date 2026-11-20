import { ApiOkResponse } from '@/decorators';
import { SystemSettingsService } from '@/services/system-settings.service';
import { SystemSettingsDto, UpdateSystemSettingsDto } from '@kleinkram/api-dto';
import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AdminOnly, LoggedIn } from '../auth/roles.decorator';

@Controller('system/settings')
export class SystemSettingsController {
    constructor(
        private readonly systemSettingsService: SystemSettingsService,
    ) {}

    @Get()
    @LoggedIn()
    @ApiOperation({
        summary: 'Get the instance-wide settings',
        description:
            'Settings an admin changes for the whole instance, such as whether the Foxglove preview tab is shown in missions.',
    })
    @ApiOkResponse({
        description: 'The current settings',
        type: SystemSettingsDto,
    })
    async getSettings(): Promise<SystemSettingsDto> {
        return this.systemSettingsService.get();
    }

    @Put()
    @AdminOnly()
    @ApiOperation({
        summary: 'Change the instance-wide settings',
        description:
            'Only admins can change the settings. Omitted fields stay as they are.',
    })
    @ApiOkResponse({
        description: 'The settings after the change',
        type: SystemSettingsDto,
    })
    async updateSettings(
        @Body() dto: UpdateSystemSettingsDto,
    ): Promise<SystemSettingsDto> {
        return this.systemSettingsService.update(dto);
    }
}
