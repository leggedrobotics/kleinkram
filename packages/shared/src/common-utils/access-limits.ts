/**
 * How many users or projects one request may add to an access group
 * (`POST /access-groups/:uuid/users`, `POST /access-groups/:uuid/projects`).
 * The web app stops its pickers at the same number.
 */
export const MAX_ACCESS_GROUP_BATCH_SIZE = 100;
