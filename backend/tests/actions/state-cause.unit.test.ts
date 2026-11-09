import {
    ActionFailureOrigin,
    ActionStateCause,
    describeStateCause,
    failureOriginOf,
    STATE_CAUSES,
    StateCauseError,
    stateCauseOfError,
} from '@kleinkram/shared';

describe('describeStateCause', () => {
    test('fills in the current creator and mission names', () => {
        expect(
            describeStateCause(
                { code: ActionStateCause.MISSION_ACCESS_LOST },
                { creatorName: 'Jane Doe', missionName: 'field-test-03' },
            ),
        ).toBe('User Jane Doe lost access to mission field-test-03');
    });

    test('reads without names when they are not known, as at write time', () => {
        expect(
            describeStateCause({ code: ActionStateCause.MISSION_ACCESS_LOST }),
        ).toBe('The creator of this action lost write access to its mission');
    });

    test('ignores the stored text once the code says what happened', () => {
        // Rows written before cause codes kept their old text, uuids and all.
        expect(
            describeStateCause(
                {
                    code: ActionStateCause.MISSION_ACCESS_LOST,
                    message:
                        'User 0800a1b2-0000-4000-8000-000000000001 lost access to mission 0800a1b2-0000-4000-8000-000000000002',
                },
                { creatorName: 'Jane Doe', missionName: 'field-test-03' },
            ),
        ).toBe('User Jane Doe lost access to mission field-test-03');
    });

    test.each(['Jane $&', 'Jane $$', "Jane $'", 'Jane $`'])(
        'inserts the name %s literally',
        (name) => {
            expect(
                describeStateCause(
                    { code: ActionStateCause.CANCELLED_BY_USER },
                    { actorName: name },
                ),
            ).toBe(`Cancelled by ${name}`);
        },
    );

    test('keeps the raw text of an external error', () => {
        expect(
            describeStateCause({
                code: ActionStateCause.INTERNAL_ERROR,
                message: 'pull access denied for foo/bar',
            }),
        ).toBe('pull access denied for foo/bar');
    });

    test('shows the stored text for a code this version does not know', () => {
        // Written by a newer queue consumer than this API server.
        expect(
            describeStateCause({
                code: 'SOMETHING_NEWER',
                message: 'Stopped for a reason added later',
            }),
        ).toBe('Stopped for a reason added later');
    });

    test('shows the stored text for rows without a code', () => {
        expect(describeStateCause({ code: null, message: 'free text' })).toBe(
            'free text',
        );
        expect(describeStateCause({ code: null })).toBeUndefined();
    });

    test('reads params defensively, as they come back from the database', () => {
        expect(
            describeStateCause({
                code: ActionStateCause.EXIT_NONZERO,
                params: { exitCode: 'not a number' },
            }),
        ).toBe('Container exited with an error');
    });

    test('every cause has a text', () => {
        for (const code of Object.values(ActionStateCause)) {
            expect(describeStateCause({ code })?.length).toBeGreaterThan(0);
        }
    });

    test('codes are stable strings that fit the column', () => {
        for (const code of Object.values(ActionStateCause)) {
            expect(code).toMatch(/^[A-Z][A-Z_]*$/);
            expect(code.length).toBeLessThanOrEqual(64);
        }
        expect(new Set(Object.keys(STATE_CAUSES))).toEqual(
            new Set(Object.values(ActionStateCause)),
        );
    });
});

describe('failureOriginOf', () => {
    test('losing access is up to the user, not Kleinkram', () => {
        expect(
            failureOriginOf({ code: ActionStateCause.MISSION_ACCESS_LOST }),
        ).toBe(ActionFailureOrigin.USER);
    });

    test('a replaced runner is Kleinkram`s doing', () => {
        expect(
            failureOriginOf({ code: ActionStateCause.RUNNER_REPLACED }),
        ).toBe(ActionFailureOrigin.SYSTEM);
    });
});

describe('stateCauseOfError', () => {
    test('an error that knows its cause keeps it', () => {
        const error = new StateCauseError({
            code: ActionStateCause.MISSION_ACCESS_LOST,
        });

        expect(stateCauseOfError(error)).toEqual({
            code: ActionStateCause.MISSION_ACCESS_LOST,
        });
        expect(error.message).toBe(
            'The creator of this action lost write access to its mission',
        );
    });

    test('any other error is an internal error with its message', () => {
        expect(stateCauseOfError(new Error('docker daemon gone'))).toEqual({
            code: ActionStateCause.INTERNAL_ERROR,
            message: 'docker daemon gone',
        });
        expect(stateCauseOfError('thrown string')).toEqual({
            code: ActionStateCause.INTERNAL_ERROR,
            message: 'thrown string',
        });
    });
});
