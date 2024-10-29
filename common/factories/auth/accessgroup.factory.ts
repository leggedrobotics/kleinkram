import { define } from 'typeorm-seeding';
import User from '../../entities/user/user.entity';
import AccessGroup from '../../entities/auth/accessgroup.entity';
import { extendedFaker } from '../../faker_extended';
import { faker } from '@faker-js/faker';

export type AccessGroupFactoryContext = {
    user: User;
    allUsers: User[];
    isPersonal: boolean;
};

define(AccessGroup, (_, context: AccessGroupFactoryContext) => {
    const accessGroup = new AccessGroup();

    if (context.isPersonal) {
        console.assert(
            context.user,
            'No user provided for personal access group',
        );
        accessGroup.name = 'Personal: ' + context.user.name;
        accessGroup.personal = true;
        accessGroup.inheriting = false;
        accessGroup.users = [context.user];
        accessGroup.creator = context.user;
    } else {
        console.assert(
            context.allUsers.length > 0,
            'No users provided for access group',
        );
        accessGroup.name = 'Group: ' + extendedFaker.company.name();
        accessGroup.personal = false;
        accessGroup.inheriting = false;
        accessGroup.users = faker.helpers.arrayElements(context.allUsers, {
            min: 0,
            max: context.allUsers.length,
        });
        accessGroup.creator = faker.helpers.arrayElement(context.allUsers);
    }

    return accessGroup;
});
