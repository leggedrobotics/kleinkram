import type { ActionTemplateDto } from '@kleinkram/api-dto';
import type ActionTemplateEntity from '@kleinkram/backend-common/entities/action/action-template.entity';
import { userEntityToDto } from './user';

export const actionTemplateEntityToDto = (
    actionTemplate: ActionTemplateEntity,
    executionCount = 0,
): ActionTemplateDto => {
    return {
        uuid: actionTemplate.uuid,
        description: actionTemplate.description,
        archived: actionTemplate.isArchived,
        accessRights: actionTemplate.accessRights,
        command: actionTemplate.command ?? '',
        cpuCores: actionTemplate.cpuCores,
        cpuMemory: actionTemplate.cpuMemory,
        entrypoint: actionTemplate.entrypoint ?? '',
        gpuMemory: actionTemplate.gpuMemory,
        imageName: actionTemplate.image_name,
        maxRuntime: actionTemplate.maxRuntime,
        createdAt: actionTemplate.createdAt ?? new Date(),
        name: actionTemplate.name,
        version: actionTemplate.version.toString(),

        creator: actionTemplate.creator
            ? userEntityToDto(actionTemplate.creator)
            : undefined,

        executionCount: executionCount,
    };
};
