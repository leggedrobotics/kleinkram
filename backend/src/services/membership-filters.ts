import { FindOperator, Raw } from 'typeorm';

/**
 * `expirationDate` filter for memberships that are still active.
 *
 * Expired memberships stay in the table until the queue consumer's expiry job
 * deletes them, so every permission check has to filter them itself. Uses the
 * database clock (`NOW()`), like `project_access_view_entity`, so the API's
 * time zone doesn't matter.
 */
export const notExpired = (): FindOperator<Date> =>
    // `Raw` is typed as FindOperator<any>
    Raw(
        (column) => `(${column} IS NULL OR ${column} > NOW())`,
    ) as FindOperator<Date>;
