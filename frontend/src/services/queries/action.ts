import axios from 'src/api/axios';
import { Action } from 'src/types/Action';

export const actions = async (missionUUID: string) => {
    const params = {
        mission_uuid: missionUUID,
        take: 100,
        skip: 0,
    };

    const response = await axios.get('/action/list', { params });
    return response.data.map((res: any) => {
        return new Action(
            res.uuid,
            new Date(res.createdAt),
            new Date(res.updatedAt),
            new Date(res.deletedAt),
            res.state,
            res.docker_image,
            null,
        );
    });
};

export const actionDetails = async (action_uuid: string) => {
    const params = {
        uuid: action_uuid,
    };

    const response = await axios.get('/action/details', { params });
    return new Action(
        response.data.uuid,
        new Date(response.data.createdAt),
        new Date(response.data.updatedAt),
        new Date(response.data.deletedAt),
        response.data.state,
        response.data.docker_image,
        null,
        response.data.logs,
    );
};
