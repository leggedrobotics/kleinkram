import { AccessGroupRights } from './enum';

/**
 * Access level a user (or API key) needs on a mission to run an action there.
 *
 * Running an action counts as a write operation on the mission, so Write is the
 * floor, even for templates that only ask for Read. A template's `accessRights`
 * set the rights of the API key the action container gets. That level can push
 * the requirement above Write (a Delete template needs Delete), but it can
 * never lower it: nobody can hand an action more rights than they hold.
 */
export function rightsRequiredToRunAction(
    templateRights: AccessGroupRights,
): AccessGroupRights {
    return Math.max(
        AccessGroupRights.WRITE,
        templateRights,
    ) as AccessGroupRights;
}
