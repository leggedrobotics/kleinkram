import axios from 'src/api/axios';
import { AccessGroupRights } from '@common/enum';
import { ActionSubmitResponseDto } from '@api/types/SubmitAction.dto';

import { ActionDto } from '@api/types/actions/action.dto';

export const createAnalysis = async (action: {
    missionUUID: string;
    templateUUID: string;
}): Promise<ActionSubmitResponseDto> => {
    const response = await axios.post<ActionSubmitResponseDto>(
        '/action/submit',
        action,
    );
    return response.data;
};

export const createMultipleAnalysis = async (action: {
    missionUUIDs: string[];
    templateUUID: string;
}) => {
    const response = await axios.post('/action/multiSubmit', action);
    return response.data;
};

export const createActionTemplate = async (template: {
    name: string;
    command: string;
    dockerImage: string;
    cpuCores: number;
    cpuMemory: number;
    gpuMemory: number;
    maxRuntime: number;
    searchable: boolean;
    entrypoint: string;
    accessRights: AccessGroupRights;
}) => {
    const response = await axios.post('/action/createTemplate', {
        name: template.name,
        command: template.command,
        image: template.dockerImage,
        cpuCores: template.cpuCores,
        cpuMemory: template.cpuMemory,
        gpuMemory: template.gpuMemory,
        maxRuntime: template.maxRuntime,
        searchable: template.searchable,
        entrypoint: template.entrypoint,
        accessRights: template.accessRights,
    });
    return response.data;
};

export const createNewActionTemplateVersion = async (template: {
    uuid: string;
    name: string;
    command: string;
    dockerImage: string;
    cpuCores: number;
    cpuMemory: number;
    gpuMemory: number;
    maxRuntime: number;
    searchable: boolean;
    entrypoint: string;
    accessRights: AccessGroupRights;
}) => {
    const response = await axios.post('/action/createNewVersion', {
        uuid: template.uuid,
        name: template.name,
        command: template.command,
        image: template.dockerImage,
        cpuCores: template.cpuCores,
        cpuMemory: template.cpuMemory,
        gpuMemory: template.gpuMemory,
        maxRuntime: template.maxRuntime,
        searchable: template.searchable,
        entrypoint: template.entrypoint,
        accessRights: template.accessRights,
    });
    return response.data;
};

export async function deleteAction(action: ActionDto) {
    return await axios.delete(`/action/${action.uuid}`);
}
