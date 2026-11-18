import type { CliConfigDto } from '@kleinkram/api-dto/types/cli/cli-config.dto';
import type { DeviceAuthorizationInfoDto } from '@kleinkram/api-dto/types/cli/device-authorization.dto';
import axios from 'src/api/axios';

export const getCliConfig = async (): Promise<CliConfigDto> => {
    const response = await axios.get<CliConfigDto>('/cli/config');
    return response.data;
};

export const getDeviceAuthorization = async (
    userCode: string,
): Promise<DeviceAuthorizationInfoDto> => {
    const response = await axios.get<DeviceAuthorizationInfoDto>(
        `/cli/device/${encodeURIComponent(userCode)}`,
    );
    return response.data;
};

export const approveDeviceAuthorization = async (
    userCode: string,
): Promise<DeviceAuthorizationInfoDto> => {
    const response = await axios.post<DeviceAuthorizationInfoDto>(
        `/cli/device/${encodeURIComponent(userCode)}/approve`,
    );
    return response.data;
};

export const denyDeviceAuthorization = async (
    userCode: string,
): Promise<DeviceAuthorizationInfoDto> => {
    const response = await axios.post<DeviceAuthorizationInfoDto>(
        `/cli/device/${encodeURIComponent(userCode)}/deny`,
    );
    return response.data;
};
