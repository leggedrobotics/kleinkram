import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AccessGroupRights } from '@kleinkram/shared';
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

    // Dynamic import or string repo access
    const ActionTemplateRepo = dataSource.getRepository('ActionTemplateEntity');

    // eslint-disable-next-line no-console
    console.log('Checking action templates...');
    for (const templateDefinition of actionTemplates) {
        const existing = await ActionTemplateRepo.findOne({
            where: { name: templateDefinition.name, version: 1 },
        });

        if (!existing) {
            const template = ActionTemplateRepo.create({
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
            await ActionTemplateRepo.save(template);
        }
    }
};
