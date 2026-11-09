import {
    ActionTemplatesQueryDto,
    FileQueryDto,
    MissionQueryDto,
} from '@kleinkram/api-dto';
import { toBoolean } from '@kleinkram/validation';
import type { ClassConstructor } from 'class-transformer';
import { plainToInstance as plainToInstanceRaw } from 'class-transformer';
import { validateSync } from 'class-validator';

// Mirror the global ValidationPipe options from backend/src/main.ts: implicit
// conversion runs before custom transforms and is what made 'false' -> true.
const plainToInstance = <T>(cls: ClassConstructor<T>, plain: object): T =>
    plainToInstanceRaw(cls, plain, { enableImplicitConversion: true });

/**
 * Regression tests for boolean query parameters.
 *
 * `@Type(() => Boolean)` calls `Boolean('false')`, which is `true`, so every
 * boolean query parameter used to be stuck at `true` as soon as the client sent
 * it explicitly. The DTOs now use `@TransformToBoolean()` instead.
 */
describe('Boolean query parameter transformation', () => {
    describe('toBoolean', () => {
        test.each([
            ['true', true],
            ['TRUE', true],
            ['  true  ', true],
            ['1', true],
            ['false', false],
            ['False', false],
            ['0', false],
            [true, true],
            [false, false],
        ])('coerces %p to %p', (input, expected) => {
            expect(toBoolean(input)).toBe(expected);
        });

        test('leaves undefined untouched', () => {
            expect(toBoolean(undefined)).toBeUndefined();
        });

        test('leaves unrecognized values untouched so validation can reject them', () => {
            expect(toBoolean('yes')).toBe('yes');
            expect(toBoolean('')).toBe('');
            expect(toBoolean(42)).toBe(42);
        });
    });

    describe('FileQueryDto.matchAllTopics', () => {
        test('"false" stays false (OR topic search)', () => {
            const dto = plainToInstance(FileQueryDto, {
                matchAllTopics: 'false',
            });
            expect(dto.matchAllTopics).toBe(false);
            expect(validateSync(dto)).toHaveLength(0);
        });

        test('"true" becomes true (AND topic search)', () => {
            const dto = plainToInstance(FileQueryDto, {
                matchAllTopics: 'true',
            });
            expect(dto.matchAllTopics).toBe(true);
            expect(validateSync(dto)).toHaveLength(0);
        });

        test('defaults to false when omitted', () => {
            const dto = plainToInstance(FileQueryDto, {});
            expect(dto.matchAllTopics).toBe(false);
            expect(validateSync(dto)).toHaveLength(0);
        });

        test('rejects values that are not boolean-ish', () => {
            const dto = plainToInstance(FileQueryDto, {
                matchAllTopics: 'maybe',
            });
            const errors = validateSync(dto);
            expect(errors).toHaveLength(1);
            expect(errors[0]?.property).toBe('matchAllTopics');
        });
    });

    describe('MissionQueryDto.minimal', () => {
        test('"false" stays false', () => {
            const dto = plainToInstance(MissionQueryDto, { minimal: 'false' });
            expect(dto.minimal).toBe(false);
            expect(validateSync(dto)).toHaveLength(0);
        });

        test('"true" becomes true', () => {
            const dto = plainToInstance(MissionQueryDto, { minimal: 'true' });
            expect(dto.minimal).toBe(true);
            expect(validateSync(dto)).toHaveLength(0);
        });

        test('stays undefined when omitted', () => {
            const dto = plainToInstance(MissionQueryDto, {});
            expect(dto.minimal).toBeUndefined();
            expect(validateSync(dto)).toHaveLength(0);
        });
    });

    describe('ActionTemplatesQueryDto.includeArchived', () => {
        test('"false" stays false (archived templates hidden)', () => {
            const dto = plainToInstance(ActionTemplatesQueryDto, {
                includeArchived: 'false',
            });
            expect(dto.includeArchived).toBe(false);
            expect(validateSync(dto)).toHaveLength(0);
        });

        test('"true" becomes true', () => {
            const dto = plainToInstance(ActionTemplatesQueryDto, {
                includeArchived: 'true',
            });
            expect(dto.includeArchived).toBe(true);
            expect(validateSync(dto)).toHaveLength(0);
        });
    });
});
