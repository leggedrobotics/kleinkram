import { AccessGroupRights } from '@common/enum';

export const accessGroupRightsList: AccessGroupRights[] = Object.values(
    AccessGroupRights,
).filter((x) => typeof x === 'number');
