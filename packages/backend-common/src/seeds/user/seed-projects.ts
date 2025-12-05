import { AccessGroupEntity } from '@backend-common/entities/auth/accessgroup.entity';
import { ProjectAccessEntity } from '@backend-common/entities/auth/project-access.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { TagTypeEntity } from '@backend-common/entities/tagType/tag-type.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { AccessGroupType } from '@kleinkram/shared';
import { Connection } from 'typeorm';
import { Factory } from 'typeorm-seeding';

export interface SeededProjects {
    createdProjects: ProjectEntity[];
    createdMissions: MissionEntity[];
    tagTypes: TagTypeEntity[];
}

export const seedProjects = async (
    factory: Factory,
    conn: Connection,
    adminUser: UserEntity,
    internalUser: UserEntity,
): Promise<SeededProjects> => {
    console.log('2. Creating Projects and Missions...');

    // 1.5 Create Tag Types
    let tagTypes: TagTypeEntity[];
    let existingTagTypes: TagTypeEntity[] = [];
    const TAG_TYPE_COUNT = 10;

    try {
        existingTagTypes = await conn.getRepository(TagTypeEntity).find();
    } catch {
        console.log('TagType table not found, will create tag types');
    }

    if (existingTagTypes.length >= TAG_TYPE_COUNT) {
        console.log('Tag types already exist, skipping tag type creation');
        tagTypes = existingTagTypes.slice(0, TAG_TYPE_COUNT);
    } else {
        console.log('Creating tag types...');
        tagTypes = await factory(TagTypeEntity)().createMany(TAG_TYPE_COUNT);
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
        existingProjects = await conn.getRepository(ProjectEntity).find();
    } catch {
        console.log('Project table not found, will create projects');
    }
    const existingProjectNames = new Set(existingProjects.map((p) => p.name));

    for (const projectDefinition of projectDefinitions) {
        if (existingProjectNames.has(projectDefinition.name)) {
            console.log(
                `Project "${projectDefinition.name}" already exists, skipping`,
            );
            // We need to fetch the existing missions if we want to return them,
            // but for now the main seeder logic mostly needs createdMissions for file seeding.
            // If we skip, we might not have them in createdMissions.
            // Let's fetch them to be safe if we want to seed files into existing projects.
            const project = existingProjects.find(
                (p) => p.name === projectDefinition.name,
            );
            if (project) {
                const missions = await conn.getRepository(MissionEntity).find({
                    where: { project: { uuid: project.uuid } },
                    relations: ['project'],
                });
                createdProjects.push(project);
                createdMissions.push(...missions);
            }
            continue;
        }

        console.log(`Creating project "${projectDefinition.name}"...`);
        const project = await factory(ProjectEntity)({
            name: projectDefinition.name,
            description: projectDefinition.description,
            creator: adminUser,
            tagTypes: tagTypes,
        } as any).create();
        createdProjects.push(project);

        // Grant access to internal user
        const internalUserGroup = await conn
            .getRepository(AccessGroupEntity)
            .findOne({
                where: {
                    creator: { uuid: internalUser.uuid },
                    type: AccessGroupType.PRIMARY,
                },
            });

        if (internalUserGroup) {
            await factory(ProjectAccessEntity)().create({
                project: project,
                accessGroup: internalUserGroup,
            });
        }

        for (const missionName of projectDefinition.missions) {
            const mission = await factory(MissionEntity)({
                project: project,
                user: adminUser,
            } as any).create({
                name: missionName,
            });
            createdMissions.push(mission);
        }
    }

    return { createdProjects, createdMissions, tagTypes };
};
