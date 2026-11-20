import type { RouteLocationRaw } from 'vue-router';

/** One row of the storage bar lists on the System page */
export interface StorageBarItem {
    key: string;
    name: string;
    sub?: string;
    bytes: number;
    /** shown in grey, e.g. all other projects together */
    other?: boolean;
    to?: RouteLocationRaw;
}
