import {
    ActionEntity,
    ActionTemplateEntity,
    ApiKeyEntity,
} from '@kleinkram/backend-common';
import { ActionState, KeyTypes } from '@kleinkram/shared';
import {
    ACTION_KEY_GRACE_MS,
    actionKeyRejection,
} from '../../src/endpoints/auth/action-key-validity';

const HOUR_MS = 60 * 60 * 1000;
const createdAt = new Date('2026-11-12T10:00:00Z');

const buildKey = (
    action: Partial<ActionEntity> | undefined,
    templateMaxRuntime = 2,
): ApiKeyEntity =>
    ({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        key_type: KeyTypes.ACTION,
        createdAt,
        action: action && {
            state: ActionState.PROCESSING,
            template: {
                maxRuntime: templateMaxRuntime,
            } as ActionTemplateEntity,
            ...action,
        },
    }) as ApiKeyEntity;

const shortlyAfter = new Date(createdAt.getTime() + 60_000);

describe('Action Key Validity', () => {
    test.each([
        ActionState.PENDING,
        ActionState.STARTING,
        ActionState.PROCESSING,
        ActionState.STOPPING,
    ])('should accept a key whose action is %s', (state) => {
        expect(
            actionKeyRejection(buildKey({ state }), shortlyAfter),
        ).toBeUndefined();
    });

    test.each([
        ActionState.DONE,
        ActionState.FAILED,
        ActionState.UNPROCESSABLE,
        ActionState.CANCELLED,
    ])('should reject a key whose action is %s', (state) => {
        expect(actionKeyRejection(buildKey({ state }), shortlyAfter)).toBe(
            'action key belongs to a finished action',
        );
    });

    test('should reject a key without an action', () => {
        expect(actionKeyRejection(buildKey(undefined), shortlyAfter)).toBe(
            'action key has no action',
        );
    });

    test('should accept a key until the template runtime plus the grace period has passed', () => {
        const lastValid = new Date(
            createdAt.getTime() + 2 * HOUR_MS + ACTION_KEY_GRACE_MS,
        );
        expect(actionKeyRejection(buildKey({}), lastValid)).toBeUndefined();
        expect(
            actionKeyRejection(buildKey({}), new Date(lastValid.getTime() + 1)),
        ).toBe('action key has expired');
    });

    test('should bound the key by the run limit if the run asked for less than the template', () => {
        const key = buildKey({ maxRuntimeHours: 0.5 });
        const afterRunLimit = new Date(
            createdAt.getTime() + 0.5 * HOUR_MS + ACTION_KEY_GRACE_MS + 1,
        );
        expect(actionKeyRejection(key, afterRunLimit)).toBe(
            'action key has expired',
        );
    });
});
