import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { ProjectAccessEntity } from '@backend-common/entities/auth/project-access.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { TagTypeEntity } from '@backend-common/entities/tagType/tag-type.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AccessGroupType } from '@kleinkram/shared';
import { DataSource } from 'typeorm';
import { SeederFactoryManager } from 'typeorm-extension';

export interface SeededProjects {
    createdProjects: ProjectEntity[];
    createdMissions: MissionEntity[];
    tagTypes: TagTypeEntity[];
}

export const seedProjects = async (
    factoryManager: SeederFactoryManager,

    dataSource: DataSource,
    adminUser: UserEntity,
    internalUser: UserEntity,
): Promise<SeededProjects> => {
    // eslint-disable-next-line no-console
    console.log('2. Creating Projects and Missions...');

    // 1.5 Create Tag Types
    let tagTypes: TagTypeEntity[];
    let existingTagTypes: TagTypeEntity[] = [];
    const TAG_TYPE_COUNT = 10;

    try {
        existingTagTypes = await dataSource.getRepository(TagTypeEntity).find();
    } catch {
        // eslint-disable-next-line no-console
        console.log('TagType table not found, will create tag types');
    }

    if (existingTagTypes.length >= TAG_TYPE_COUNT) {
        // eslint-disable-next-line no-console
        console.log('Tag types already exist, skipping tag type creation');
        tagTypes = existingTagTypes.slice(0, TAG_TYPE_COUNT);
    } else {
        // eslint-disable-next-line no-console
        console.log('Creating tag types...');
        tagTypes = await factoryManager
            .get(TagTypeEntity)
            .saveMany(TAG_TYPE_COUNT);
    }

    // 2. Create Projects and Missions
    const projectDefinitions = [
        {
            name: 'Autonomous Driving',
            description:
                'Development and testing of autonomous driving algorithms for highway and urban environments.',
            missions: ['Highway Pilot', 'Urban Navigation'],
        },
        {
            name: 'Robotics Manipulation',
            description:
                'Research on robotic arm manipulation tasks including pick-and-place and complex assembly.',
            missions: ['Pick and Place', 'Assembly'],
        },
        {
            name: 'Drone Surveillance',
            description:
                'Aerial surveillance missions for perimeter security and search and rescue operations.',
            missions: ['Perimeter Check', 'Search and Rescue'],
        },
    ];

    const createdProjects: ProjectEntity[] = [];
    const createdMissions: MissionEntity[] = [];

    // Check if projects already exist

    let existingProjects: ProjectEntity[] = [];
    try {
        existingProjects = await dataSource.getRepository(ProjectEntity).find();
    } catch {
        // eslint-disable-next-line no-console
        console.log('Project table not found, will create projects');
    }
    const existingProjectNames = new Set(existingProjects.map((p) => p.name));

    for (const projectDefinition of projectDefinitions) {
        if (existingProjectNames.has(projectDefinition.name)) {
            // eslint-disable-next-line no-console
            console.log(
                `Project "${projectDefinition.name}" already exists, skipping`,
            );

            const project = existingProjects.find(
                (p) => p.name === projectDefinition.name,
            );
            if (project) {
                const missions = await dataSource
                    .getRepository(MissionEntity)
                    .find({
                        where: { project: { uuid: project.uuid } },
                        relations: ['project'],
                    });

                createdProjects.push(project);
                createdMissions.push(...missions);
            }
            continue;
        }

        console.log(`Creating project "${projectDefinition.name}"...`);
        const project = await factoryManager
            .get(ProjectEntity)
            .setMeta({
                name: projectDefinition.name,
                description: projectDefinition.description,
                creator: adminUser,
                tagTypes: tagTypes,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
            .save();
        createdProjects.push(project);

        // Grant access to internal user
        const internalUserGroup = await dataSource
            .getRepository(AccessGroupEntity)
            .findOne({
                where: {
                    creator: { uuid: internalUser.uuid },
                    type: AccessGroupType.PRIMARY,
                },
            });

        if (internalUserGroup) {
            await factoryManager
                .get(ProjectAccessEntity)
                .setMeta({
                    project: project,
                    accessGroup: internalUserGroup,
                })
                .save();
        }

        for (const missionName of projectDefinition.missions) {
            const mission = await factoryManager
                .get(MissionEntity)
                .setMeta({
                    project: project,
                    user: adminUser,
                    name: missionName,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any)
                .save();
            createdMissions.push(mission);
        }
    }

    return { createdProjects, createdMissions, tagTypes };
};
