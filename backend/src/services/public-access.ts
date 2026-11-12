import {
    AccessGroupRights,
    isGrantableAccessGroupRight,
    PUBLIC_ACCESS_GROUP,
    PUBLIC_ACCESS_RIGHTS,
} from '@kleinkram/shared';
import { BadRequestException, ConflictException } from '@nestjs/common';

/**
 * Rules for the public access group (see `AccessGroupType.PUBLIC`).
 *
 * The group stands for every user, so it may only ever grant READ rights on
 * a project, and its (implicit) members cannot be changed.
 */

export const isPublicAccessGroup = (accessGroupUuid: string): boolean =>
    accessGroupUuid === PUBLIC_ACCESS_GROUP.uuid;

/**
 * Rights needed to make a project public or restricted again, that is to add,
 * change or remove the public access group's entry. Public access shares the
 * project with every user, so it takes the same rights as deleting it.
 */
export const PUBLIC_ACCESS_MANAGE_RIGHTS = AccessGroupRights.DELETE;

/**
 * Rejects granting the public access group anything but READ rights.
 */
export const assertValidPublicAccessRights = (
    accessGroupUuid: string,
    rights: AccessGroupRights,
): void => {
    if (isPublicAccessGroup(accessGroupUuid) && rights > PUBLIC_ACCESS_RIGHTS) {
        throw new ConflictException(
            'Public access is read-only. Grant higher rights through an access group.',
        );
    }
};

/**
 * Rejects changing the members of the public access group, or deleting it.
 * Every user is implicitly a member.
 */
export const assertNotPublicAccessGroup = (accessGroupUuid: string): void => {
    if (isPublicAccessGroup(accessGroupUuid)) {
        throw new ConflictException(
            'The public access group includes every user and cannot be changed.',
        );
    }
};

/**
 * Rejects rights that cannot be stored on a project access entry, most
 * importantly `_ADMIN` (100): it ranks above DELETE in every `>=` check, so a
 * user with WRITE rights could otherwise grant it to themselves.
 */
export const assertGrantableAccessRights = (rights: unknown): void => {
    if (!isGrantableAccessGroupRight(rights)) {
        throw new BadRequestException(
            `Invalid access rights: ${String(rights)}`,
        );
    }
};
