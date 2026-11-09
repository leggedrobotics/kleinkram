import { AccessGroupRights } from './enum';

/**
 * The system access group of type `PUBLIC`. A project that grants this group
 * access is public: every user can read it without being added to a group.
 *
 * The uuid is fixed so that the frontend and the CLI can address the group
 * without looking it up first.
 */
export const PUBLIC_ACCESS_GROUP = {
    uuid: '00000000-0000-4000-8000-000000000001',
    name: 'All Kleinkram Users',
} as const;

/**
 * The only rights the public group can hold. Anything beyond reading has to
 * be granted through a regular access group.
 */
export const PUBLIC_ACCESS_RIGHTS = AccessGroupRights.READ;
