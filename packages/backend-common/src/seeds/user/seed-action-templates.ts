import { UserEntity } from '@backend-common/entities/user/user.entity';
import { Connection } from 'typeorm';

export const seedActionTemplates = async (
    conn: Connection,
    adminUser: UserEntity,
): Promise<void> => {
    console.log('3. Creating Action Templates...');
    const tag = 'latest';

    const actionTemplates = [
        { name: 'validate-data', description: 'Validates data integrity' },
        {
            name: 'extract-metadata',
            description: 'Extracts metadata from files',
        },
        { name: 'convert-formats', description: 'Converts file formats' },
        {
            name: 'python-template',
            description: 'Basic Python action template',
        },
    ];

    // Dynamic import or string repo access
    const ActionTemplateRepo = conn.getRepository('ActionTemplateEntity');

    console.log('Checking action templates...');
    for (const templateDefinition of actionTemplates) {
        const existing = await ActionTemplateRepo.findOne({
            where: { name: templateDefinition.name, version: 1 },
        });

        if (!existing) {
            const template = ActionTemplateRepo.create({
                name: templateDefinition.name,
                description: templateDefinition.description,
                image_name: `rslethz/action:${templateDefinition.name}-${tag}`,
                version: 1,
                creator: adminUser,
                cpuCores: 1,
                cpuMemory: 1,
                gpuMemory: -1,
                maxRuntime: 1,
                accessRights: 0,
            });
            await ActionTemplateRepo.save(template);
        }
    }
};
