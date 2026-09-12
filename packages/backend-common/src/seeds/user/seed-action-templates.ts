import { ActionTemplateEntity } from '@backend-common/entities/action/action-template.entity';
import { ActionTriggerEntity } from '@backend-common/entities/action/action-trigger.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AccessGroupRights, TriggerType } from '@kleinkram/shared';
import { DataSource } from 'typeorm';

export const seedActionTemplates = async (
    dataSource: DataSource,
    adminUser: UserEntity,
): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log('3. Creating Action Templates...');
    const tag = 'latest';

    const actionTemplates: {
        name: string;
        description: string;
        accessRights?: number;
    }[] = [
        {
            name: 'validate-data',
            description: 'Validates data integrity',
        },
        {
            name: 'extract-metadata',
            description: 'Extracts metadata from files',
        },
        {
            name: 'convert-formats',
            description: 'Converts file formats',
        },
        {
            name: 'python-template',
            description: 'Basic Python action template',
        },
        {
            name: 'gpu-example',
            description: 'Example action utilizing GPU resources',
        },
        {
            name: 'recover-mcap',
            description:
                'Recovers corrupted MCAP files using mcap doctor and mcap recover',
            accessRights: AccessGroupRights.WRITE,
        },
    ];

    const actionTemplateRepo = dataSource.getRepository(ActionTemplateEntity);
    const actionTriggerRepo = dataSource.getRepository(ActionTriggerEntity);
    const projectRepo = dataSource.getRepository(ProjectEntity);

    // eslint-disable-next-line no-console
    console.log('Checking action templates...');
    for (const templateDefinition of actionTemplates) {
        const existing = await actionTemplateRepo.findOne({
            where: { name: templateDefinition.name, version: 1 },
        });

        if (!existing) {
            const template = actionTemplateRepo.create({
                name: templateDefinition.name,
                description: templateDefinition.description,

                // eslint-disable-next-line @typescript-eslint/naming-convention
                image_name: `rslethz/action:${templateDefinition.name}-${tag}`,
                version: 1,
                creator: adminUser,
                cpuCores: 1,
                cpuMemory: 1,
                gpuMemory: -1,
                maxRuntime: 1,
                accessRights: templateDefinition.accessRights ?? 0,
            });
            await actionTemplateRepo.save(template);
        }
    }

    // Ensure recover-mcap trigger exists for projects with autoRecoverMcap enabled
    const recoverTemplate = await actionTemplateRepo.findOne({
        where: { name: 'recover-mcap', version: 1 },
    });
    if (recoverTemplate) {
        const projects = await projectRepo.find();
        for (const project of projects) {
            if (project.autoRecoverMcap ?? true) {
                const existingTrigger = await actionTriggerRepo.findOne({
                    where: {
                        projectUuid: project.uuid,
                        type: TriggerType.CORRUPTED_FILE,
                    },
                });
                if (!existingTrigger) {
                    const trigger = actionTriggerRepo.create({
                        name: 'Auto-recover MCAP',
                        description:
                            'Automatically recovers corrupted MCAP files uploaded to this project',
                        template: recoverTemplate,
                        project: project,
                        type: TriggerType.CORRUPTED_FILE,
                        config: { patterns: ['*.mcap'] },
                        creator: adminUser,
                    });
                    await actionTriggerRepo.save(trigger);
                }
            }
        }
    }
};
