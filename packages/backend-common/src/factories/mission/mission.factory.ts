import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { type Faker } from '@faker-js/faker';
import { setSeederFactory } from 'typeorm-extension';

export interface MissionContext {
    project: ProjectEntity;
    user: UserEntity;
    name?: string;
}

setSeederFactory(
    MissionEntity,
    (_faker: Faker, context: Partial<MissionContext> = {}) => {
        if (!context.project) {
            throw new Error('Project is required');
        }

        if (!context.user) {
            throw new Error('User is required');
        }

        const mission = new MissionEntity();
        mission.name = context.name ?? extendedFaker.mission.name();
        mission.creator = context.user;
        mission.project = context.project;
        mission.uuid = extendedFaker.string.uuid();
        return mission;
    },
);
