import { define } from 'typeorm-seeding';
import User from '../../entities/user/user.entity';
import AccessGroup from '../../entities/auth/accessgroup.entity';
import { extendedFaker } from '../../faker_extended';
import { faker } from '@faker-js/faker';

export type AccessGroupFactoryContext = {
    user: User;
    all_users: User[];
    is_personal: boolean;
};

define(AccessGroup, (_, context: AccessGroupFactoryContext) => {
    const accessGroup = new AccessGroup();

    if (context.is_personal) {
        console.assert(
            context.user,
            'No user provided for personal access group',
        );
        accessGroup.name = 'Personal: ' + context.user.name;
        accessGroup.personal = true;
        accessGroup.inheriting = false;
        accessGroup.users = [context.user];
    } else {
        console.assert(
            context.all_users.length > 0,
            'No users provided for access group',
        );
        accessGroup.name = 'Group: ' + extendedFaker.company.name();
        accessGroup.personal = false;
        accessGroup.inheriting = false;
        accessGroup.users = faker.helpers.arrayElements(context.all_users, {
            min: 0,
            max: context.all_users.length,
        });
    }

    return accessGroup;
});
