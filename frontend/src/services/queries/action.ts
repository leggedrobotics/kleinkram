import axios from 'src/api/axios';
import { Action } from 'src/types/Action';
import { User } from 'src/types/User';
import { ActionTemplate } from 'src/types/ActionTemplate';
import { Mission } from 'src/types/Mission';
import { Worker } from 'src/types/Worker';

export const getActions = async (
    projectUUID: string,
    missionUUID: string,
    take: number,
    skip: number,
    sortBy: string,
    descending: boolean,
    search: string,
): Promise<[Action[], number]> => {
    const params: Record<string, string | number | boolean> = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        project_uuid: projectUUID,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        mission_uuid: missionUUID,
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };

    if (search) {
        params['search'] = search;
    }

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
            [],
            res.createdBy.createdAt,
            res.createdBy.updatedAt,
        );

        const template = new ActionTemplate(
            res.template.uuid,
            res.template.createdAt,
            res.template.updatedAt,
            res.template.image_name,
            user,
            res.template.name,
            res.template.version,
            res.template.command,
            res.template.cpuCores,
            res.template.cpuMemory,
            res.template.gpuMemory,
            res.template.maxRuntime,
            res.template.entrypoint,
            res.template.accessRights,
        );

        const mission = new Mission(
            res.mission.uuid,
            res.mission.name,
            undefined,
            [],
            [],
            undefined,
            new Date(res.mission.createdAt),
            new Date(res.mission.updatedAt),
        );
        let worker = null;
        if (res.worker) {
            worker = new Worker(
                res.worker.uuid,
                res.worker.identifier,
                res.worker.hostname,
                res.worker.createdAt,
                res.worker.updatedAt,
                res.worker.cpuMemory,
                res.worker.gpuModel,
                res.worker.gpuMemory,
                res.worker.cpuCores,
                res.worker.cpuModel,
                res.worker.storage,
                res.worker.lastSeen,
                res.worker.reachable,
            );
        }
        return new Action(
            res.uuid,
            new Date(res.createdAt),
            new Date(res.updatedAt),
            res.state,
            res.state_cause,
            res.artifact_url,
            res.artifacts,
            mission,
            template,
            res.image,
            user,
            null,
            null,
            worker,
        );
    });
    return [resi, response.data[1]];
};

export const actionDetails = async (actionUuid: string) => {
    const params = {
        uuid: actionUuid,
    };

    const response = await axios.get('/action/details', { params });
    const user = new User(
        response.data.createdBy.uuid,
        response.data.createdBy.name,
        response.data.createdBy.email,
        response.data.createdBy.role,
        response.data.createdBy.avatarUrl,
        [],
        [],
        response.data.createdBy.createdAt,
        response.data.createdBy.updatedAt,
    );
    const template = new ActionTemplate(
        response.data.template.uuid,
        new Date(response.data.template.createdAt),
        new Date(response.data.template.updatedAt),
        response.data.template.image_name,
        null,
        response.data.template.name,
        response.data.template.version,
        response.data.template.command,
        response.data.template.cpuCores,
        response.data.template.cpuMemory,
        response.data.template.gpuMemory,
        response.data.template.maxRuntime,
        response.data.template.entrypoint,
        response.data.template.accessRights,
    );
    try {
        let worker = null;
        if (response.data.worker) {
            worker = new Worker(
                response.data.worker.uuid,
                response.data.worker.identifier,
                response.data.worker.hostname,
                response.data.worker.createdAt,
                response.data.worker.updatedAt,
                response.data.worker.cpuMemory,
                response.data.worker.gpuModel,
                response.data.worker.gpuMemory,
                response.data.worker.cpuCores,
                response.data.worker.cpuModel,
                response.data.worker.storage,
                response.data.worker.lastSeen,
                response.data.worker.reachable,
            );
        }
        return new Action(
            response.data.uuid,
            new Date(response.data.createdAt),
            new Date(response.data.updatedAt),
            response.data.state,
            response.data.state_cause,
            response.data.artifact_url,
            response.data.artifacts,
            null,
            template,
            response.data.image,
            user,
            response.data.logs,
            response.data.auditLogs,
            worker,
            response.data.executionStartedAt,
            response.data.executionEndedAt,
        );
    } catch (e) {
        console.log(e);
    }
};

export const listActionTemplates = async (search: string) => {
    const params: Record<string, string> = {};
    if (search) {
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
            [],
            res.createdBy.createdAt,
            res.createdBy.updatedAt,
        );
        return new ActionTemplate(
            res.uuid,
            res.createdAt,
            res.updatedAt,
            res.image_name,
            user,
            res.name,
            res.version,
            res.command,
            res.cpuCores,
            res.cpuMemory,
            res.gpuMemory,
            res.maxRuntime,
            res.entrypoint,
            res.accessRights,
        );
    });
};

export const getRunningActions = async () => {
    const response = await axios.get('/action/running', {
        params: { skip: 0, take: 10 },
    });
    return response.data[0].map((res: any) => {
        const user = new User(
            res.createdBy.uuid,
            res.createdBy.name,
            res.createdBy.email,
            res.createdBy.role,
            res.createdBy.avatarUrl,
            [],
            [],
            res.createdBy.createdAt,
            res.createdBy.updatedAt,
        );
        const template = new ActionTemplate(
            res.template.uuid,
            res.template.createdAt,
            res.template.updatedAt,
            res.template.image_name,
            user,
            res.template.name,
            res.template.version,
            res.template.command,
            res.template.cpuCores,
            res.template.cpuMemory,
            res.template.gpuMemory,
            res.template.maxRuntime,
            res.template.entrypoint,
            res.template.accessRights,
        );
        const mission = new Mission(
            res.mission.uuid,
            res.mission.name,
            undefined,
            [],
            [],
            undefined,
            new Date(res.mission.createdAt),
            new Date(res.mission.updatedAt),
        );
        let worker = null;
        if (res.worker) {
            worker = new Worker(
                res.worker.uuid,
                res.worker.identifier,
                res.worker.hostname,
                res.worker.createdAt,
                res.worker.updatedAt,
                res.worker.cpuMemory,
                res.worker.gpuModel,
                res.worker.gpuMemory,
                res.worker.cpuCores,
                res.worker.cpuModel,
                res.worker.storage,
                res.worker.lastSeen,
                res.worker.reachable,
            );
        }
        return new Action(
            res.uuid,
            new Date(res.createdAt),
            new Date(res.updatedAt),
            res.state,
            res.state_cause,
            res.artifact_url,
            res.artifacts,
            mission,
            template,
            res.image,
            user,
            null,
            null,
            worker,
        );
    });
};
