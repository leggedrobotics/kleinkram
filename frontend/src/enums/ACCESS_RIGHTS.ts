/* eslint-disable @typescript-eslint/naming-convention */
export enum AccessGroupRights {
    READ = 0,
    CREATE = 10,
    WRITE = 20,
    DELETE = 30,
}

export const accessGroupRightsList: AccessGroupRights[] = Object.values(
    AccessGroupRights,
).filter((x) => typeof x === 'number');
