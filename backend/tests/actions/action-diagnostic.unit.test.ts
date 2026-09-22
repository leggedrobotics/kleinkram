import {
    ActionDiagnosticEntity,
    ActionEntity,
} from '@kleinkram/backend-common';
import {
    ACTION_DIAGNOSTIC_LIMIT,
    ActionSeverity,
    ActionState,
    DiagnosticSeverity,
    KeyTypes,
} from '@kleinkram/shared';
import { ExecutionContext } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReportActionDiagnosticGuard } from '../../src/endpoints/auth/guards/action.guards';
import { ActionDiagnosticService } from '../../src/services/action-diagnostic.service';

interface Harness {
    service: ActionDiagnosticService;
    actionUpdate: jest.Mock;
    diagnosticUpdate: jest.Mock;
    diagnosticSave: jest.Mock;
    actionIncrement: jest.Mock;
    severitySet: jest.Mock;
    severityWhereIn: jest.Mock;
}

const buildHarness = (
    action: Partial<ActionEntity>,
    existingDiagnostic: Partial<ActionDiagnosticEntity> | null = null,
): Harness => {
    const actionUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const diagnosticUpdate = jest.fn().mockResolvedValue({ affected: 1 });
    const diagnosticSave = jest.fn().mockResolvedValue({});
    const actionIncrement = jest.fn().mockResolvedValue({ affected: 1 });

    // The severity write is a conditional UPDATE built through the query
    // builder, so the spies capture what it set and what it refused to
    // overwrite.
    const severitySet = jest.fn();
    const severityWhereIn = jest.fn();
    const queryBuilder = {
        update: () => queryBuilder,
        set: (values: unknown) => {
            severitySet(values);
            return queryBuilder;
        },
        where: () => queryBuilder,
        andWhere: (_clause: string, parameters: unknown) => {
            severityWhereIn(parameters);
            return queryBuilder;
        },
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const actionRepositoryInTransaction = {
        findOne: jest.fn().mockResolvedValue({
            uuid: 'action-uuid',
            state: ActionState.PROCESSING,
            severity: ActionSeverity.OK,
            diagnosticCount: 0,
            diagnosticsTruncated: false,
            ...action,
        }),
        update: actionUpdate,
        increment: actionIncrement,
        createQueryBuilder: () => queryBuilder,
    };

    const diagnosticRepositoryInTransaction = {
        findOne: jest.fn().mockResolvedValue(existingDiagnostic),
        update: diagnosticUpdate,
        save: diagnosticSave,
        create: (values: unknown) => values,
    };

    const manager = {
        getRepository: (entity: unknown) =>
            entity === ActionEntity
                ? actionRepositoryInTransaction
                : diagnosticRepositoryInTransaction,
    };

    const actionRepository = {
        manager: {
            transaction: (callback: (m: unknown) => Promise<void>) =>
                callback(manager),
        },
    } as unknown as Repository<ActionEntity>;

    return {
        service: new ActionDiagnosticService(
            actionRepository,
            {} as unknown as Repository<ActionDiagnosticEntity>,
        ),
        actionUpdate,
        diagnosticUpdate,
        diagnosticSave,
        actionIncrement,
        severitySet,
        severityWhereIn,
    };
};

const warning = {
    severity: DiagnosticSeverity.WARNING,
    message: 'missing /tf topic',
    code: 'MISSING_TF',
    file: 'run_1.bag',
};

describe('ActionDiagnosticService.record', () => {
    test('a warning raises the action severity to WARNING', async () => {
        const harness = buildHarness({});

        await harness.service.record('action-uuid', warning);

        expect(harness.severitySet).toHaveBeenCalledWith({
            severity: ActionSeverity.WARNING,
        });
    });

    test('the severity write refuses to overwrite an equal or higher verdict', async () => {
        const harness = buildHarness({});

        await harness.service.record('action-uuid', warning);

        // A conditional UPDATE rather than a read-modify-write: only a
        // strictly lower verdict may be overwritten, so a concurrent ERROR
        // cannot be talked back down to WARNING.
        expect(harness.severityWhereIn).toHaveBeenCalledWith({
            overwritable: [ActionSeverity.OK],
        });
    });

    test('an INFO diagnostic leaves the action reading as clean', async () => {
        const harness = buildHarness({});

        await harness.service.record('action-uuid', {
            severity: DiagnosticSeverity.INFO,
            message: 'processed 12 bags',
        });

        expect(harness.severitySet).not.toHaveBeenCalled();
    });

    test('a warning does not talk an existing ERROR verdict back down', async () => {
        const harness = buildHarness({ severity: ActionSeverity.ERROR });

        await harness.service.record('action-uuid', warning);

        expect(harness.severityWhereIn).toHaveBeenCalledWith({
            overwritable: [ActionSeverity.OK],
        });
    });

    test('an identical report bumps the count instead of adding a row', async () => {
        const harness = buildHarness(
            { diagnosticCount: 1 },
            {
                uuid: 'diagnostic-uuid',
                count: 3,
            },
        );

        await harness.service.record('action-uuid', warning);

        expect(harness.diagnosticUpdate).toHaveBeenCalledWith(
            { uuid: 'diagnostic-uuid' },
            { count: 4 },
        );
        expect(harness.diagnosticSave).not.toHaveBeenCalled();
    });

    test('a new report is stored and counted on the action', async () => {
        const harness = buildHarness({ diagnosticCount: 7 });

        await harness.service.record('action-uuid', warning);

        expect(harness.diagnosticSave).toHaveBeenCalled();
        // An atomic SET col = col + 1, never a value read and written back.
        expect(harness.actionIncrement).toHaveBeenCalledWith(
            { uuid: 'action-uuid' },
            'diagnosticCount',
            1,
        );
    });

    test('past the cap the action is flagged truncated and no row is stored', async () => {
        const harness = buildHarness({
            diagnosticCount: ACTION_DIAGNOSTIC_LIMIT,
        });

        await harness.service.record('action-uuid', warning);

        expect(harness.diagnosticSave).not.toHaveBeenCalled();
        expect(harness.actionIncrement).not.toHaveBeenCalled();
        expect(harness.actionUpdate).toHaveBeenCalledWith(
            { uuid: 'action-uuid' },
            { diagnosticsTruncated: true },
        );
    });

    test('past the cap the severity is still raised', async () => {
        const harness = buildHarness({
            diagnosticCount: ACTION_DIAGNOSTIC_LIMIT,
        });

        await harness.service.record('action-uuid', warning);

        expect(harness.severitySet).toHaveBeenCalledWith({
            severity: ActionSeverity.WARNING,
        });
    });

    test('an identical report does not increment the action count', async () => {
        const harness = buildHarness(
            { diagnosticCount: 1 },
            { uuid: 'diagnostic-uuid', count: 1 },
        );

        await harness.service.record('action-uuid', warning);

        expect(harness.actionIncrement).not.toHaveBeenCalled();
    });

    test.each([
        ActionState.DONE,
        ActionState.FAILED,
        ActionState.CANCELLED,
        ActionState.UNPROCESSABLE,
    ])('an action already in state %s cannot report', async (state) => {
        const harness = buildHarness({ state });

        await expect(
            harness.service.record('action-uuid', warning),
        ).rejects.toThrow(/already finished/);
    });

    test('an unknown action is rejected', async () => {
        const actionRepository = {
            manager: {
                transaction: (callback: (m: unknown) => Promise<void>) =>
                    callback({
                        getRepository: () => ({
                            findOne: jest.fn().mockResolvedValue(null),
                        }),
                    }),
            },
        } as unknown as Repository<ActionEntity>;

        const service = new ActionDiagnosticService(
            actionRepository,
            {} as unknown as Repository<ActionDiagnosticEntity>,
        );

        await expect(service.record('missing', warning)).rejects.toThrow(
            /Action not found/,
        );
    });
});

const buildContext = (user: unknown): ExecutionContext =>
    ({
        switchToHttp: () => ({
            getRequest: () => ({
                params: { uuid: 'action-uuid' },
                user,
            }),
        }),
    }) as unknown as ExecutionContext;

const buildGuard = (
    keyUuidOnAction: string | undefined,
): ReportActionDiagnosticGuard => {
    const actionRepository = {
        findOne: jest.fn().mockResolvedValue(
            keyUuidOnAction === undefined
                ? null
                : {
                      uuid: 'action-uuid',
                      key: { uuid: keyUuidOnAction },
                  },
        ),
    } as unknown as Repository<ActionEntity>;

    return new ReportActionDiagnosticGuard(actionRepository);
};

describe('ReportActionDiagnosticGuard', () => {
    test('accepts the action key minted for this action', async () => {
        const guard = buildGuard('key-uuid');

        await expect(
            guard.canActivate(
                buildContext({
                    user: { uuid: 'u' },
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    apiKey: { uuid: 'key-uuid', key_type: KeyTypes.ACTION },
                }),
            ),
        ).resolves.toBe(true);
    });

    test('rejects an action key belonging to a different action', async () => {
        const guard = buildGuard('some-other-key');

        await expect(
            guard.canActivate(
                buildContext({
                    user: { uuid: 'u' },
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    apiKey: { uuid: 'key-uuid', key_type: KeyTypes.ACTION },
                }),
            ),
        ).resolves.toBe(false);
    });

    test('rejects a plain user session', async () => {
        const guard = buildGuard('key-uuid');

        await expect(
            guard.canActivate(buildContext({ user: { uuid: 'u' } })),
        ).resolves.toBe(false);
    });
});
