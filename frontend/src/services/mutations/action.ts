import axios from 'src/api/axios';
import { ActionTemplate } from 'src/types/ActionTemplate';

export const createAnalysis = async (action: {
    missionUUID: string;
    templateUUID: string;
}) => {
    const response = await axios.post('/action/submit', action);
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
    docker_image: string;
    cpuCores: number;
    cpuMemory: number;
    gpuMemory: number;
    maxRuntime: number;
    searchable: boolean;
}) => {
    console.log(template);
    const response = await axios.post('/action/createTemplate', {
        name: template.name,
        command: template.command,
        image: template.docker_image,
        cpuCores: template.cpuCores,
        cpuMemory: template.cpuMemory,
        gpuMemory: template.gpuMemory,
        maxRuntime: template.maxRuntime,
        searchable: template.searchable,
    });
    const res = response.data;
    return new ActionTemplate(
        res.uuid,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        res.image_name,
        undefined,
        res.name,
        res.version,
        res.command,
        res.cpuCores,
        res.cpuMemory,
        res.gpuMemory,
        res.maxRuntime,
    );
};

export const createNewActionTemplateVersion = async (template: {
    uuid: string;
    name: string;
    command: string;
    docker_image: string;
    cpuCores: number;
    cpuMemory: number;
    gpuMemory: number;
    maxRuntime: number;
    searchable: boolean;
}) => {
    const response = await axios.post('/action/createNewVersion', {
        uuid: template.uuid,
        name: template.name,
        command: template.command,
        image: template.docker_image,
        cpuCores: template.cpuCores,
        cpuMemory: template.cpuMemory,
        gpuMemory: template.gpuMemory,
        maxRuntime: template.maxRuntime,
        searchable: template.searchable,
    });
    const res = response.data;
    return new ActionTemplate(
        res.uuid,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        res.image_name,
        undefined,
        res.name,
        res.version,
        res.command,
        res.cpuCores,
        res.cpuMemory,
        res.gpuMemory,
        res.maxRuntime,
    );
};
