import { resolveStateCause, stateCauseReference } from '@kleinkram/shared';

const userUuid = '0800a1b2-0000-4000-8000-000000000001';
const missionUuid = '0800a1b2-0000-4000-8000-000000000002';

describe('resolveStateCause', () => {
    const names = { [userUuid]: 'Jane Doe', [missionUuid]: 'field-test-03' };

    test('replaces references with current names', () => {
        const cause = `User ${stateCauseReference('user', userUuid)} lost access to mission ${stateCauseReference('mission', missionUuid)}`;

        expect(resolveStateCause(cause, names)).toBe(
            'User Jane Doe lost access to mission field-test-03',
        );
    });

    test('falls back to the bare uuid for unknown references', () => {
        const cause = `User ${stateCauseReference('user', userUuid)} lost access`;

        expect(resolveStateCause(cause, {})).toBe(
            `User ${userUuid} lost access`,
        );
    });

    test('resolves bare uuids in causes written before references existed', () => {
        const cause = `User ${userUuid} lost access to mission ${missionUuid}`;

        expect(resolveStateCause(cause, names)).toBe(
            'User Jane Doe lost access to mission field-test-03',
        );
    });

    test('leaves causes without uuids untouched', () => {
        expect(resolveStateCause('Action cancelled by user', names)).toBe(
            'Action cancelled by user',
        );
    });
});
