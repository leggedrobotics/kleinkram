import type {
    SystemSettingsDto,
    UpdateSystemSettingsDto,
} from '@kleinkram/api-dto/types/system-settings.dto';
import axios from 'src/api/axios';

export const updateSystemSettings = async (
    changes: UpdateSystemSettingsDto,
): Promise<SystemSettingsDto> => {
    const response = await axios.put<SystemSettingsDto>(
        'system/settings',
        changes,
    );
    return response.data;
};
