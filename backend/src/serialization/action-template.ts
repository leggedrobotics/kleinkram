import type { ActionTemplateDto } from '@kleinkram/api-dto';
import type { ActionTemplateEntity } from '@kleinkram/backend-common/entities/action/action-template.entity';
import { userEntityToDto } from './index';

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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        createdAt: actionTemplate.createdAt ?? new Date(),
        name: actionTemplate.name,
        version: actionTemplate.version.toString(),

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        creator: actionTemplate.creator
            ? userEntityToDto(actionTemplate.creator)
            : undefined,

        executionCount: executionCount,
    };
};
