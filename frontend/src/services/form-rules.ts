/**
 * Validation rules for Quasar fields in forms. Use them with `lazy-rules`
 * and `no-error-icon`, so a field is only checked after it was left (or the
 * form is submitted) and then live while it is being fixed.
 */

/** The field must not be empty, e.g. `required('Project description')` */
export const required =
    (label: string) =>
    (value: string | number | null | undefined): true | string =>
        (value !== null &&
            value !== undefined &&
            String(value).trim() !== '') ||
        `${label} is required.`;
