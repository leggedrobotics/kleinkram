import { Factory, Seeder } from 'typeorm-seeding';
import User from '../../entities/user/user.entity';
import { UserContext } from '../../factories/user/user.factory';
import { FileType, UserRole } from '../../enum';
import { Connection } from 'typeorm';
import AccessGroup from '../../entities/auth/accessgroup.entity';
import { AccessGroupFactoryContext } from '../../factories/auth/accessgroup.factory';
import Project from '../../entities/project/project.entity';
import Mission from '../../entities/mission/mission.entity';
import { extendedFaker } from '../../faker_extended';
import FileEntity from '../../entities/file/file.entity';
import Topic from '../../entities/topic/topic.entity';
import ProjectAccess from '../../entities/auth/project_access.entity';
import { ProjectContext } from '../../factories/project/project.factory';
import TagType from '../../entities/tagType/tagType.entity';

export default class CreateUsers implements Seeder {
    // Settings for the Seeder
    private USER_COUNT = 30;
    private ACCESS_GROUP_COUNT = 20;
    private PROJECT_COUNT = 40;
    private GROUP_ACCESS_COUNT = 200;
    private SEED_ADMINS = false;
    private TAG_TYPE_COUNT = 15;

    public async run(factory: Factory, conn: Connection): Promise<void> {
        // //////////////////////////////////////////
        // Abort Seeding if Users already exist
        // //////////////////////////////////////////
        const usersCount = await conn.getRepository(User).count();
        if (usersCount > 0) {
            console.log(
                '\n\n »» Users already exist in the DB; skipping seeding\n\n',
            );
            return;
        }

        // //////////////////////////////////////////
        // Start Seeding
        // //////////////////////////////////////////

        // Generate Tag Types...
        const tagTypes = await factory(TagType)({}).createMany(
            this.TAG_TYPE_COUNT,
        );

        // Generate Users...
        const admin_mails = [
            'cyrillp@leggedrobotics.com',
            'johannsch@leggedrobotics.com',
            'noelk@leggedrobotics.com',
        ];

        // generate admin users
        // and add them to the default group
        const admin_users = await Promise.all(
            admin_mails.map((mail) =>
                factory(User)({
                    mail,
                    role: this.SEED_ADMINS ? UserRole.ADMIN : UserRole.USER,
                    default_group_ids: ['00000000-0000-0000-0000-000000000000'],
                } as UserContext).create(),
            ),
        );

        // generate remaining users
        const remaining_user_count = this.USER_COUNT - admin_mails.length;
        const users = await factory(User)({
            role: UserRole.USER,
        }).createMany(remaining_user_count);

        const all_users = admin_users.concat(users);

        // create personal access groups
        const personal_access_groups = await Promise.all(
            all_users.map((user) =>
                factory(AccessGroup)({
                    user: user,
                    is_personal: true,
                } as AccessGroupFactoryContext).create(),
            ),
        );

        // generate additional groups
        const groups = await factory(AccessGroup)({
            all_users: all_users,
            is_personal: false,
        } as AccessGroupFactoryContext).createMany(this.ACCESS_GROUP_COUNT);

        const all_access_groups = personal_access_groups.concat(groups);

        // Generate Projects, Missions, Files, and Topics...
        const projects = await factory(Project)({
            all_access_groups,
            all_users,
            tagTypes,
        } as ProjectContext).createMany(this.PROJECT_COUNT);

        // set access rights for projects
        await factory(ProjectAccess)({
            projects: projects,
            accessGroups: all_access_groups,
        }).createMany(this.GROUP_ACCESS_COUNT);

        for (const project of projects) {
            const missions = await factory(Mission)({
                user: project.creator,
                project,
            }).createMany(
                extendedFaker.number.int({
                    min: 0,
                    max: 20,
                }),
            );
            for (const mission of missions) {
                const files = await factory(FileEntity)({
                    user: mission.creator,
                    mission,
                }).createMany(
                    extendedFaker.number.int({
                        min: 0,
                        max: 20,
                    }),
                );
                for (const file of files) {
                    if (file.type == FileType.BAG) continue; // only MCAP files have topics
                    await factory(Topic)({ file }).createMany(
                        extendedFaker.number.int({ min: 0, max: 20 }),
                    );
                }
            }
        }
    }
}
