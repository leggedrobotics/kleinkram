import axios from 'src/api/axios';
import { AccessGroupDto, AccessGroupsDto } from '@api/types/User.dto';
import { ProjectAccessDto } from '@api/types/Project.dto';
import { AxiosResponse } from 'axios';
import { AccessGroupType } from '@common/enum';

export const canAddAccessGroup = async (
    projectUuid: string,
): Promise<boolean> => {
    if (projectUuid === '') {
        return false;
    }
    const response = await axios.get('/access/canAddAccessGroupToProject', {
        params: { uuid: projectUuid },
    });

    return response.data;
};

export const searchAccessGroups = async (
    search: string,
    type: AccessGroupType | undefined,
    skip: number,
    take: number,
): Promise<AccessGroupsDto> => {
    const params: {
        take: number;
        search: string;
        skip: number;
        type: AccessGroupType | undefined;
    } = {
        search,
        skip,
        type,
        take,
    };

    const response: AxiosResponse<AccessGroupsDto> = await axios.get(
        '/access/filtered',
        {
            params,
        },
    );

    return response.data;
};

export const getAccessGroup = async (uuid: string): Promise<AccessGroupDto> => {
    const response = await axios.get(`/access/one`, { params: { uuid } });
    return response.data;
};

export const getProjectAccess = async (
    projectUUID: string,
    projectAccessUUID: string,
): Promise<ProjectAccessDto> => {
    const response = await axios.get(`/access/projectAccess`, {
        params: { uuid: projectUUID, projectAccessUUID },
    });
    return response.data;
};
