import axios from 'src/api/axios';
import { Action } from 'src/types/Action';
import { User } from 'src/types/User';

export const getActions = async (
    missionUUID: string,
    take: number,
    skip: number,
    sortBy: string,
    descending: boolean,
): Promise<[Action[], number]> => {
    const params = {
        mission_uuid: missionUUID,
        take,
        skip,
        sortBy,
        descending,
    };

    const response = await axios.get('/action/list', { params });
    if (response.data.length < 2) {
        return [[], 0];
    }
    const resi = response.data[0].map((res: any) => {
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
    return [resi, response.data[1]];
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
        response.data.runner_hostname,
        response.data.runner_cpu_model,
        response.data.executionStartedAt,
        response.data.executionEndedAt,
    );
};
