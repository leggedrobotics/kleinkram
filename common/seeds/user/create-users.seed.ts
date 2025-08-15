import { Connection, Not } from 'typeorm';
import { Factory, Seeder } from 'typeorm-seeding';
import AccessGroup from '../../entities/auth/accessgroup.entity';
import ProjectAccess from '../../entities/auth/project-access.entity';
import FileEntity from '../../entities/file/file.entity';
import Mission from '../../entities/mission/mission.entity';
import Project from '../../entities/project/project.entity';
import TagType from '../../entities/tagType/tag-type.entity';
import Topic from '../../entities/topic/topic.entity';
import User from '../../entities/user/user.entity';
import { AccessGroupFactoryContext } from '../../factories/auth/accessgroup.factory';
import { ProjectContext } from '../../factories/project/project.factory';
import { UserContext } from '../../factories/user/user.factory';
import { extendedFaker } from '../../faker-extended';
import { FileType, UserRole } from '../../frontend_shared/enum';

export default class CreateUsers implements Seeder {
    // Settings for the Seeder

    private USER_COUNT = 10;
    private ACCESS_GROUP_COUNT = 20;
    private PROJECT_COUNT = 10;
    private GROUP_ACCESS_COUNT = 2;
    private SEED_ADMINS = false;
    private TAG_TYPE_COUNT = 10;

    public async run(factory: Factory, conn: Connection): Promise<void> {
        // //////////////////////////////////////////
        // Abort Seeding if Users already exist
        // //////////////////////////////////////////
        const usersCount = await conn.getRepository(User).count({
            where: { uuid: Not('10000000-0000-0000-0000-000000000000') },
        });
        if (usersCount > 0) {
            console.log(
                '\n\n »» Users already exist in the DB; skipping seeding\n\n',
            );
            return;
        }
        console.log('\n\n »» Seeding Users...\n\n');

        // //////////////////////////////////////////
        // Start Seeding
        // //////////////////////////////////////////

        // Generate Metadata...
        const tagTypes = await factory(TagType)({}).createMany(
            this.TAG_TYPE_COUNT,
        );

        // Generate Users...
        const adminMails = ['cyrillp@leggedrobotics.com'];

        // generate admin users
        // and add them to the affiliation group
        const adminUsers =
            (await Promise.all(
                adminMails.map((mail) =>
                    factory(User)({
                        mail,
                        role: this.SEED_ADMINS ? UserRole.ADMIN : UserRole.USER,
                        defaultGroupIds: [
                            '00000000-0000-0000-0000-000000000000',
                        ],
                    } as UserContext).create(),
                ),
            )
                // catch any errors during user creation
                .catch(console.error)) ?? [];

        // generate remaining users
        const remainingUserCount = this.USER_COUNT - adminMails.length;
        const users =
            (await factory(User)({
                role: UserRole.USER,
            })
                .createMany(remainingUserCount)
                // catch any errors during user creation
                .catch(console.error)) ?? [];

        const allUsers = [...adminUsers, ...users];

        // create personal access groups
        await Promise.all(
            allUsers.map((user) =>
                factory(AccessGroup)({
                    user: user,
                    isPersonal: true,
                } as AccessGroupFactoryContext).create(),
            ),
        )
            // catch any errors during personal access group creation
            .catch(console.error);

        // generate additional groups
        const accessGroups = await factory(AccessGroup)({
            allUsers: allUsers,
            isPersonal: false,
        } as AccessGroupFactoryContext).createMany(this.ACCESS_GROUP_COUNT);

        // Generate Projects, Missions, Files, and Topics...
        const projects =
            (await factory(Project)({
                allAccessGroups: accessGroups,
                allUsers: allUsers,
                tagTypes,
            } as ProjectContext)
                .createMany(this.PROJECT_COUNT)
                // catch any errors during project creation
                .catch(console.error)) ?? [];

        // set access rights for projects
        await factory(ProjectAccess)({
            projects: projects,
            accessGroups: accessGroups,
        }).createMany(this.GROUP_ACCESS_COUNT);

        for (const project of projects) {
            const missions =
                (await factory(Mission)({
                    user: project.creator,
                    project,
                })
                    .createMany(
                        extendedFaker.number.int({
                            min: 0,
                            max: 20,
                        }),
                    )
                    // catch any errors during mission creation
                    .catch(console.error)) ?? [];

            for (const mission of missions) {
                const files =
                    (await factory(FileEntity)({
                        user: mission.creator,
                        mission,
                    })
                        .createMany(
                            extendedFaker.number.int({
                                min: 0,
                                max: 20,
                            }),
                        )
                        // catch any errors during file creation
                        .catch(console.error)) ?? [];

                for (const file of files) {
                    if (file.type === FileType.BAG) continue; // only MCAP files have topics
                    await factory(Topic)({ file })
                        .createMany(
                            extendedFaker.number.int({ min: 0, max: 20 }),
                        )
                        // catch any errors during topic creation
                        .catch(console.error);
                }
            }
        }
    }
}
