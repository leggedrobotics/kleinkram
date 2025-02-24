import axios from 'src/api/axios';
import { AccessGroupDto } from '@api/types/user.dto';
import { AxiosResponse } from 'axios';
import { AccessGroupType } from '@common/enum';
import { AccessGroupsDto } from '@api/types/access-control/access-groups.dto';
import { ProjectAccessListDto } from '@api/types/access-control/project-access.dto';

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
    projectAccessUUID: string,
): Promise<ProjectAccessListDto> => {
    const response = await axios.get(`/access/projectAccesses`, {
        params: { uuid: projectUUID, projectAccessUUID },
    });
    return response.data;
};
