import { Transform } from 'class-transformer';

/**
 * Coerces a query parameter value into a boolean.
 *
 * Query parameters always arrive as strings, so `@Type(() => Boolean)` cannot
 * be used: it calls `Boolean('false')`, which is `true`. This helper only
 * converts values it actually recognises and returns everything else
 * unchanged, so `@IsBoolean()` can reject unparseable input and `@IsOptional()`
 * can skip missing values.
 *
 * Accepted (case-insensitive, surrounding whitespace ignored):
 * `true`, `false`, `1`, `0` and actual booleans.
 *
 * @param value the raw query parameter value
 * @returns the coerced boolean, or `value` unchanged if it is not recognised
 */
export const toBoolean = (value: unknown): unknown => {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();

        if (normalized === 'true' || normalized === '1') {
            return true;
        }

        if (normalized === 'false' || normalized === '0') {
            return false;
        }
    }

    return value;
};

/**
 * Property decorator applying {@link toBoolean} during transformation.
 *
 * Use together with `@IsBoolean()` (and `@IsOptional()` where applicable) on
 * query parameter DTO fields instead of `@Type(() => Boolean)`.
 *
 * @returns the property decorator
 */
export const TransformToBoolean = (): PropertyDecorator =>
    Transform(({ value, obj, key }): unknown => {
        // With `enableImplicitConversion` (used by the global ValidationPipe)
        // class-transformer has already run `Boolean(value)` on the reflected
        // type before this hook is called, turning 'false' into `true`. Read
        // the untouched source value instead.
        const source: unknown = obj;
        const raw =
            source !== null && typeof source === 'object' && key in source
                ? (source as Record<string, unknown>)[key]
                : (value as unknown);
        return toBoolean(raw);
    });
