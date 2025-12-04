import { AccessGroupDto } from '@kleinkram/api-dto/types/access-control/access-group.dto';
import { AccessGroupsDto } from '@kleinkram/api-dto/types/access-control/access-groups.dto';
import { ProjectAccessListDto } from '@kleinkram/api-dto/types/access-control/project-access.dto';
import { AccessGroupType } from '@kleinkram/shared';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

export const searchAccessGroups = async (
    search: string,
    type: AccessGroupType | undefined,
    skip: number,
    take: number,
): Promise<AccessGroupsDto> => {
    const parameters: {
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
            params: parameters,
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
): Promise<ProjectAccessListDto> => {
    const response = await axios.get(`/projects/${projectUUID}/access`);
    return response.data;
};
