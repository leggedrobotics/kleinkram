import { define } from 'typeorm-seeding';
import User from '../../entities/user/user.entity';
import AccessGroup from '../../entities/auth/accessgroup.entity';
import { extendedFaker } from '../../faker-extended';
import { faker } from '@faker-js/faker';
import { AccessGroupType } from '../../frontend_shared/enum';
import GroupMembership from '../../entities/auth/group-membership.entity';

export interface AccessGroupFactoryContext {
    user: User;
    allUsers: User[];
    isPersonal: boolean;
}

// @ts-expect-error
define(AccessGroup, (_, context: AccessGroupFactoryContext) => {
    const accessGroup = new AccessGroup();

    if (context.isPersonal) {
        console.assert(
            context.user,
            'No user provided for personal access group',
        );
        accessGroup.name = context.user.name;
        accessGroup.type = AccessGroupType.PRIMARY;
        accessGroup.creator = context.user;
    } else {
        console.assert(
            context.allUsers.length > 0,
            'No users provided for access group',
        );
        accessGroup.name = `Group: ${extendedFaker.company.name()}`;
        accessGroup.type = AccessGroupType.CUSTOM;
        accessGroup.creator = faker.helpers.arrayElement(context.allUsers);

        // add members to group
        accessGroup.memberships = context.allUsers.map(
            (user) =>
                ({
                    user,
                    canEditGroup: user === accessGroup.creator,
                }) as GroupMembership,
        );
    }

    return accessGroup;
});
