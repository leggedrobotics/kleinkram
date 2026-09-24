import { AccessGroupRights } from '@kleinkram/shared';
import { BadRequestException } from '@nestjs/common';

/**
 * Rights that can be stored on a project access. `AccessGroupRights._ADMIN`
 * is a frontend-only marker for platform admins and must never be granted:
 * rights checks compare with `>=`, so it would pass every DELETE check.
 */
const GRANTABLE_RIGHTS: ReadonlySet<AccessGroupRights> = new Set([
    AccessGroupRights.READ,
    AccessGroupRights.CREATE,
    AccessGroupRights.WRITE,
    AccessGroupRights.DELETE,
]);

export const assertGrantableRights = (rights: AccessGroupRights): void => {
    if (!GRANTABLE_RIGHTS.has(rights)) {
        throw new BadRequestException(`Rights ${String(rights)} are invalid`);
    }
};
