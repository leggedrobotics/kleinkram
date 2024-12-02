import { define } from 'typeorm-seeding';
import Project from '../../entities/project/project.entity';
import Mission from '../../entities/mission/mission.entity';
import User from '../../entities/user/user.entity';
import { extendedFaker } from '../../faker_extended';

export interface MissionContext {
    project: Project;
    user: User;
}

define(Mission, (_, context: Partial<MissionContext> = {}) => {
    if (!context.project) {
        throw new Error('Project is required');
    }

    if (!context.user) {
        throw new Error('User is required');
    }

    const mission = new Mission();
    mission.name = extendedFaker.mission.name();
    mission.creator = context.user;
    mission.project = context.project;
    mission.uuid = extendedFaker.string.uuid();
    return mission;
});
