import type { SystemSettingsDto } from '@kleinkram/api-dto/types/system-settings.dto';
import axios from 'src/api/axios';

export const getSystemSettings = async (): Promise<SystemSettingsDto> => {
    const response = await axios.get<SystemSettingsDto>('system/settings');
    return response.data;
};
