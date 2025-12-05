import { AccessGroupEntity } from '@backend-common/entities/auth/accessgroup.entity';
import { GroupMembershipEntity } from '@backend-common/entities/auth/group-membership.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { extendedFaker } from '@backend-common/faker-extended';
import { faker } from '@faker-js/faker';
import { AccessGroupType } from '@kleinkram/shared';
import { define } from 'typeorm-seeding';

export interface AccessGroupFactoryContext {
    user: UserEntity;
    allUsers: UserEntity[];
    isPersonal: boolean;
}

// @ts-expect-error
define(AccessGroupEntity, (_, context: AccessGroupFactoryContext) => {
    const accessGroup = new AccessGroupEntity();

    if (context.isPersonal) {
        // eslint-disable-next-line no-console
        console.assert(
            context.user,
            'No user provided for personal access group',
        );
        accessGroup.name = context.user.name;
        accessGroup.type = AccessGroupType.PRIMARY;
        accessGroup.creator = context.user;

        accessGroup.memberships = [
            {
                user: context.user,
                canEditGroup: false,
            } as GroupMembershipEntity,
        ];
    } else {
        // eslint-disable-next-line no-console
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
                }) as GroupMembershipEntity,
        );
    }

    return accessGroup;
});
