import {
    emailMatchesDomain,
    loadAccessConfig,
} from '@backend-common/access-config';
import { AccessGroupEntity } from '@backend-common/entities/auth/access-group.entity';
import { GroupMembershipEntity } from '@backend-common/entities/auth/group-membership.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { UserRole } from '@kleinkram/shared';
import { setSeederFactory } from 'typeorm-extension';

export interface UserContext {
    firstName: string;
    lastName: string;
    mail: string;
    role: UserRole;
    defaultGroupIds: string[];
}

setSeederFactory(UserEntity, (context: Partial<UserContext> = {}) => {
    const role =
        context.role ??
        extendedFaker.helpers.arrayElement([UserRole.ADMIN, UserRole.USER]);
    const firstName = context.firstName ?? extendedFaker.person.firstName();
    const lastName = context.lastName ?? extendedFaker.person.lastName();
    const mail =
        context.mail ?? extendedFaker.internet.email({ firstName, lastName });

    const user = new UserEntity();
    user.name = `${firstName} ${lastName}`;
    user.email = mail;
    user.role = role;
    user.avatarUrl = extendedFaker.image.avatarGitHub();
    user.uuid = extendedFaker.string.uuid();

    let groupIds: string[] = context.defaultGroupIds ?? [];

    try {
        const config = loadAccessConfig();
        for (const emailConfig of config.emails) {
            if (emailMatchesDomain(user.email, emailConfig.email)) {
                groupIds = [...groupIds, ...emailConfig.access_groups];
            }
        }
    } catch {
        // no access config available, e.g. outside of a deployment
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
});
