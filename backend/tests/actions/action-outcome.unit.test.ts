import {
    ACTION_DIAGNOSTIC_LIMIT,
    ActionFailureOrigin,
    ActionSeverity,
    actionSeverityFromDiagnostic,
    ActionState,
    DiagnosticSeverity,
    EXIT_CODE_WARNING,
    maxActionSeverity,
    resolveActionOutcome,
} from '@kleinkram/shared';

describe('resolveActionOutcome', () => {
    test('exit 0 is a clean success', () => {
        const outcome = resolveActionOutcome({ exitCode: 0 });

        expect(outcome.state).toBe(ActionState.DONE);
        expect(outcome.severity).toBe(ActionSeverity.OK);
        expect(outcome.failureOrigin).toBeUndefined();
    });

    test('the reserved warning exit code completes the action with a warning', () => {
        const outcome = resolveActionOutcome({ exitCode: EXIT_CODE_WARNING });

        expect(outcome.state).toBe(ActionState.DONE);
        expect(outcome.severity).toBe(ActionSeverity.WARNING);
        expect(outcome.failureOrigin).toBeUndefined();
        expect(outcome.stateCause).toContain('warnings');
    });

    test('the reserved warning exit code is 75, outside the docker and signal ranges', () => {
        expect(EXIT_CODE_WARNING).toBe(75);
        expect(EXIT_CODE_WARNING).toBeLessThan(125);
        expect(EXIT_CODE_WARNING).toBeGreaterThan(2);
    });

    test.each([1, 2, 42, 125, 126, 127, 137, 139, 143])(
        'exit %i fails the action with severity ERROR',
        (exitCode) => {
            const outcome = resolveActionOutcome({ exitCode });

            expect(outcome.state).toBe(ActionState.FAILED);
            expect(outcome.severity).toBe(ActionSeverity.ERROR);
        },
    );

    test.each([1, 2, 42, 125, 126, 127, 139])(
        'exit %i is the user`s own failure',
        (exitCode) => {
            expect(resolveActionOutcome({ exitCode }).failureOrigin).toBe(
                ActionFailureOrigin.USER,
            );
        },
    );

    test('an OOM kill names the memory limit and blames the user', () => {
        const outcome = resolveActionOutcome({
            exitCode: 137,
            oomKilled: true,
        });

        expect(outcome.failureOrigin).toBe(ActionFailureOrigin.USER);
        expect(outcome.stateCause).toContain('OOMKilled');
    });

    test('a 137 without an OOM flag keeps the wording the error hint service matches on', () => {
        const outcome = resolveActionOutcome({
            exitCode: 137,
            oomKilled: false,
        });

        expect(outcome.stateCause).toContain(
            'Container killed (SIGKILL). Exceeded memory or CPU limit.',
        );
    });

    test('a runner interrupt is our fault, whatever the exit code says', () => {
        const outcome = resolveActionOutcome({
            exitCode: 137,
            interruptedByRunner: true,
        });

        expect(outcome.failureOrigin).toBe(ActionFailureOrigin.SYSTEM);
    });

    test('a runtime limit is the action`s own fault', () => {
        const outcome = resolveActionOutcome({
            exitCode: 143,
            runtimeLimitExceeded: true,
        });

        expect(outcome.failureOrigin).toBe(ActionFailureOrigin.USER);
    });

    test('a failure always carries a blame, and a success never does', () => {
        for (const exitCode of [0, 1, 2, 75, 125, 126, 127, 137, 139, 143]) {
            const outcome = resolveActionOutcome({ exitCode });

            expect(
                outcome.state === ActionState.FAILED
                    ? outcome.failureOrigin !== undefined
                    : outcome.failureOrigin === undefined,
            ).toBe(true);
        }
    });

    test('every outcome carries a non-empty cause', () => {
        for (const exitCode of [0, 1, 75, 125, 137, 143, 255]) {
            expect(
                resolveActionOutcome({ exitCode }).stateCause.length,
            ).toBeGreaterThan(0);
        }
    });
});

describe('severity helpers', () => {
    test('maxActionSeverity never lowers a verdict', () => {
        expect(
            maxActionSeverity(ActionSeverity.WARNING, ActionSeverity.OK),
        ).toBe(ActionSeverity.WARNING);
        expect(
            maxActionSeverity(ActionSeverity.OK, ActionSeverity.WARNING),
        ).toBe(ActionSeverity.WARNING);
        expect(
            maxActionSeverity(ActionSeverity.ERROR, ActionSeverity.WARNING),
        ).toBe(ActionSeverity.ERROR);
    });

    test('maxActionSeverity is commutative across every pair', () => {
        for (const a of Object.values(ActionSeverity)) {
            for (const b of Object.values(ActionSeverity)) {
                expect(maxActionSeverity(a, b)).toBe(maxActionSeverity(b, a));
            }
        }
    });

    test('an INFO diagnostic leaves the action reading as clean', () => {
        expect(actionSeverityFromDiagnostic(DiagnosticSeverity.INFO)).toBe(
            ActionSeverity.OK,
        );
    });

    test('warnings and errors carry through to the action', () => {
        expect(actionSeverityFromDiagnostic(DiagnosticSeverity.WARNING)).toBe(
            ActionSeverity.WARNING,
        );
        expect(actionSeverityFromDiagnostic(DiagnosticSeverity.ERROR)).toBe(
            ActionSeverity.ERROR,
        );
    });

    test('every diagnostic severity maps to a verdict', () => {
        for (const severity of Object.values(DiagnosticSeverity)) {
            expect(Object.values(ActionSeverity)).toContain(
                actionSeverityFromDiagnostic(severity),
            );
        }
    });

    test('the diagnostic cap is a positive bound', () => {
        expect(ACTION_DIAGNOSTIC_LIMIT).toBeGreaterThan(0);
    });
});
