import {Factory, Seeder} from "typeorm-seeding";
import User from "../../entities/user/user.entity";
import {UserContext} from "../../factories/user/user.factory";
import {FileType, UserRole} from "../../enum";
import Project from "../../entities/project/project.entity";
import Mission from "../../entities/mission/mission.entity";
import FileEntity from "../../entities/file/file.entity";
import Topic from "../../entities/topic/topic.entity";
import {extendedFaker} from "../../faker_extended";

export default class CreateUsers implements Seeder {
    public async run(factory: Factory): Promise<void> {

        // generate user and projects
        const users = await factory(User)().createMany(10)
        const mails = ['cyrillp@leggedrobotics.com', 'johannsch@leggedrobotics.com']
        const specificUsers = await Promise.all(
            mails.map(mail => factory(User)({mail, role: UserRole.ADMIN} as UserContext)
                .create())
        );

        for (const user of users.concat(specificUsers)) {
            const projects = await factory(Project)({user}).createMany(extendedFaker.number.int({min: 0, max: 20}))
            for (const project of projects) {
                const missions = await factory(Mission)({user, project}).createMany(extendedFaker.number.int({
                    min: 0,
                    max: 20
                }))
                for (const mission of missions) {
                    const files = await factory(FileEntity)({user, mission}).createMany(extendedFaker.number.int({
                        min: 0,
                        max: 20
                    }))
                    for (const file of files) {
                        if (file.type == FileType.BAG) continue // only MCAP files have topics
                        await factory(Topic)({file}).createMany(extendedFaker.number.int({min: 0, max: 20}))
                    }
                }
            }
        }

    }
}