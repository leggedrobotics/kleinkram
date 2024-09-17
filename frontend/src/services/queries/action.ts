import axios from 'src/api/axios';
import { Action } from 'src/types/Action';
import { User } from 'src/types/User';
import { ActionTemplate } from 'src/types/ActionTemplate';

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

    const response = await axios.get('/action/listActions', { params });
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

        const template = new ActionTemplate(
            res.template.uuid,
            res.template.createdAt,
            res.template.updatedAt,
            res.template.deletedAt,
            res.template.image,
            user,
            res.template.name,
            res.template.version,
            res.template.command,
            res.template.runtime_requirements,
        );

        return new Action(
            res.uuid,
            new Date(res.createdAt),
            new Date(res.updatedAt),
            new Date(res.deletedAt),
            res.state,
            res.state_cause,
            res.artifact_url,
            res.uploading_artifacts,
            null,
            template,
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

    const template = new ActionTemplate(
        response.data.template.uuid,
        new Date(response.data.template.createdAt),
        new Date(response.data.template.updatedAt),
        new Date(response.data.template.deletedAt),
        response.data.template.image,
        undefined,
        response.data.template.name,
        response.data.template.version,
        response.data.template.command,
        response.data.template.runtime_requirements,
    );
    console.log('template', template);
    return new Action(
        response.data.uuid,
        new Date(response.data.createdAt),
        new Date(response.data.updatedAt),
        new Date(response.data.deletedAt),
        response.data.state,
        response.data.state_cause,
        response.data.artifact_url,
        response.data.uploading_artifacts,

        null,
        template,
        user,
        response.data.logs,
        response.data.runner_info.hostname,
        response.data.runner_info.runtime_capabilities.cpu_model,
        response.data.executionStartedAt,
        response.data.executionEndedAt,
    );
};

export const listActionTemplates = async (search: string) => {
    const params = {};
    if (search) {
        console.log('search', search);
        params['search'] = search;
    }
    const response = await axios.get('/action/listTemplates', {
        params,
    });
    return response.data[0].map((res: any) => {
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
        return new ActionTemplate(
            res.uuid,
            res.createdAt,
            res.updatedAt,
            res.deletedAt,
            res.image,
            user,
            res.name,
            res.version,
            res.command,
            res.runtime_requirements,
        );
    });
};
