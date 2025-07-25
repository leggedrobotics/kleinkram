import { define } from 'typeorm-seeding';
import AccessGroup from '../../entities/auth/accessgroup.entity';
import GroupMembership from '../../entities/auth/group-membership.entity';
import User from '../../entities/user/user.entity';
import { extendedFaker } from '../../faker-extended';
import { UserRole } from '../../frontend_shared/enum';

export interface UserContext {
    firstName: string;
    lastName: string;
    mail: string;
    role: UserRole;
    defaultGroupIds: string[];
}

define(User, (_, context: Partial<UserContext> = {}) => {
    const role =
        context.role ??
        extendedFaker.helpers.arrayElement([UserRole.ADMIN, UserRole.USER]);
    const firstName = context.firstName || extendedFaker.person.firstName();
    const lastName = context.lastName || extendedFaker.person.lastName();
    const mail =
        context.mail || extendedFaker.internet.email({ firstName, lastName });

    const user = new User();
    user.name = `${firstName} ${lastName}`;
    user.email = mail;
    user.role = role;
    user.avatarUrl = extendedFaker.image.avatarGitHub();
    user.uuid = extendedFaker.string.uuid();

    if (context.defaultGroupIds) {
        // TODO: fix...
        user.memberships = context.defaultGroupIds.map((id) => {
            const accessGroup = new AccessGroup();
            accessGroup.uuid = id;
            return accessGroup;
        }) as unknown as GroupMembership[];
    }

    return user;
});
