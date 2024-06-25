import {define} from 'typeorm-seeding'
import Project from "../../entities/project/project.entity";
import Mission from "../../entities/mission/mission.entity";
import User from "../../entities/user/user.entity";
import {extendedFaker} from "../../faker_extended";


export type MissionContext = {
    project: Project
    user: User
}

define(Mission, (_, context: Partial<MissionContext> = {}) => {

    const mission = new Mission()
    mission.name = extendedFaker.mission.name()
    mission.creator = context?.user || null
    mission.project = context?.project || null
    mission.uuid = extendedFaker.string.uuid()
    return mission

})
