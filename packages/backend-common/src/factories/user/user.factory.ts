import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { GroupMembershipEntity } from '@backend-common/entities/auth/group-membership.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { type Faker } from '@faker-js/faker';
import { UserRole } from '@kleinkram/shared';
import * as fs from 'node:fs';
import path from 'node:path';
import { setSeederFactory } from 'typeorm-extension';

export interface UserContext {
    firstName: string;
    lastName: string;
    mail: string;
    role: UserRole;
    defaultGroupIds: string[];
}

interface AccessGroupConfig {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    emails: { email: string; access_groups: string[] }[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    access_groups: { name: string; uuid: string; rights: number }[];
}

setSeederFactory(
    UserEntity,
    (_faker: Faker, context: Partial<UserContext> = {}) => {
        const role =
            context.role ??
            extendedFaker.helpers.arrayElement([UserRole.ADMIN, UserRole.USER]);
        const firstName = context.firstName ?? extendedFaker.person.firstName();
        const lastName = context.lastName ?? extendedFaker.person.lastName();
        const mail =
            context.mail ??
            extendedFaker.internet.email({ firstName, lastName });

        const user = new UserEntity();
        user.name = `${firstName} ${lastName}`;
        user.email = mail;
        user.role = role;
        user.avatarUrl = extendedFaker.image.avatarGitHub();
        user.uuid = extendedFaker.string.uuid();

        let groupIds: string[] = context.defaultGroupIds ?? [];

        try {
            const configPath = path.resolve(
                __dirname,
                '@backend-common/../../../backend/src/access_config.json',
            );

            if (fs.existsSync(configPath)) {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(configContent) as AccessGroupConfig;

                for (const emailConfig of config.emails) {
                    if (user.email.endsWith(emailConfig.email)) {
                        groupIds = [...groupIds, ...emailConfig.access_groups];
                    }
                }
            }
        } catch {
            // ignore
        }

        // Deduplicate
        groupIds = [...new Set(groupIds)];

        if (groupIds.length > 0) {
            user.memberships = groupIds.map((id) => {
                const membership = new GroupMembershipEntity();
                membership.accessGroup = { uuid: id } as AccessGroupEntity;
                return membership;
            });
        }

        return user;
    },
);
