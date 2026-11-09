import {
    AccessGroupRights,
    rightsRequiredToRunAction,
} from '@kleinkram/shared';

describe('rightsRequiredToRunAction', () => {
    test('running an action needs at least Write, whatever the template asks', () => {
        expect(rightsRequiredToRunAction(AccessGroupRights.READ)).toBe(
            AccessGroupRights.WRITE,
        );
        expect(rightsRequiredToRunAction(AccessGroupRights.CREATE)).toBe(
            AccessGroupRights.WRITE,
        );
        expect(rightsRequiredToRunAction(AccessGroupRights.WRITE)).toBe(
            AccessGroupRights.WRITE,
        );
    });

    test('a template asking for more than Write raises the requirement', () => {
        expect(rightsRequiredToRunAction(AccessGroupRights.DELETE)).toBe(
            AccessGroupRights.DELETE,
        );
    });
});
