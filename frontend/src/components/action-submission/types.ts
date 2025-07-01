import { AccessGroupRights } from '@common/enum';

export interface GpuModel {
    useGPU: boolean;
    gpuModel: string;
    gpuMemory: number;
}

export interface ActionConfiguration {
    missionUuids: string[];
    actionTemplate: {
        templateName: string;
        parentTemplate: string | undefined;
    };
    actionDefinition: {
        imageName: string;
        trigger: string;
        command: string;
        entrypoint: string;
    };
    accessRights: {
        label: string;
        value: AccessGroupRights;
    };
    actionResources: {
        cpuMemory: number;
        cpuCores: number;
        gpu: GpuModel;
        maxRuntime: number;
    };
}

export interface ActionConfigurationValidationError {
    fieldPath: string;
    errorMessage: string;
}
