import axios from 'src/api/axios';
import { Action } from 'src/types/Action';
import { User } from 'src/types/User';

export const getActions = async (missionUUID: string) => {
    const params = {
        mission_uuid: missionUUID,
        take: 100,
        skip: 0,
    };

    const response = await axios.get('/action/list', { params });
    return response.data.map((res: any) => {
        const user = new User(
            res.createdBy.uuid,
            res.createdBy.name,
            res.createdBy.email,
            res.createdBy.role,
            res.createdBy.avatarUrl,
            [],
            res.createdBy.createdAt,
            res.createdBy.updatedAt,
            res.createdBy.deletedAt,
        );

        return new Action(
            res.uuid,
            new Date(res.createdAt),
            new Date(res.updatedAt),
            new Date(res.deletedAt),
            res.state,
            res.state_cause,
            res.docker_image,
            res.docker_image_sha,
            null,
            user,
        );
    });
};

export const actionDetails = async (action_uuid: string) => {
    const params = {
        uuid: action_uuid,
    };

    const response = await axios.get('/action/details', { params });
    const user = new User(
        response.data.createdBy.uuid,
        response.data.createdBy.name,
        response.data.createdBy.email,
        response.data.createdBy.role,
        response.data.createdBy.avatarUrl,
        [],
        response.data.createdBy.createdAt,
        response.data.createdBy.updatedAt,
        response.data.createdBy.deletedAt,
    );

    return new Action(
        response.data.uuid,
        new Date(response.data.createdAt),
        new Date(response.data.updatedAt),
        new Date(response.data.deletedAt),
        response.data.state,
        response.data.state_cause,
        response.data.docker_image,
        response.data.docker_image_sha,
        null,
        user,
        response.data.logs,
    );
};
