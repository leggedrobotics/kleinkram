import { define } from 'typeorm-seeding';
import User from '../../entities/user/user.entity';
import { UserRole } from '../../enum';
import { extendedFaker } from '../../faker_extended';
import AccessGroup from '../../entities/auth/accessgroup.entity';

export type UserContext = {
    firstName: string;
    lastName: string;
    mail: string;
    role: UserRole;
    default_group_ids: string[];
};

define(User, (_, context: Partial<UserContext> = {}) => {
    const role =
        context?.role ||
        extendedFaker.helpers.arrayElement([UserRole.ADMIN, UserRole.USER]);
    const firstName = context?.firstName || extendedFaker.person.firstName();
    const lastName = context?.lastName || extendedFaker.person.lastName();
    const mail =
        context?.mail || extendedFaker.internet.email({ firstName, lastName });

    const user = new User();
    user.name = `${firstName} ${lastName}`;
    user.email = mail;
    user.role = role;
    user.avatarUrl = extendedFaker.image.avatarGitHub();
    user.uuid = extendedFaker.string.uuid();

    if (context.default_group_ids) {
        user.accessGroups = context.default_group_ids.map((id) => {
            const accessGroup = new AccessGroup();
            accessGroup.uuid = id;
            return accessGroup;
        });
    }

    return user;
});
