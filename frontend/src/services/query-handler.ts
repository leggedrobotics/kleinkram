import { FileType } from '@kleinkram/shared';
import { watch } from 'vue';
import { RouteLocationNormalizedLoaded, Router } from 'vue-router';

const DEFAULT_SORT = { sortBy: 'name', descending: false };
const DEFAULT_PAGINATION = { page: 1, rowsPerPage: 20 };
const DEFAULT_SEARCH = {};
const DEFAULT_FILE_TYPES: FileType[] = Object.values(FileType);

/**
 * Class passed around to handle the query state
 * Contains logic for pagination, sorting, filtering and the current data type
 */
export class QueryHandler {
    page: number;
    take: number;
    sortBy: string;
    descending: boolean;
    missionUuid?: string;
    projectUuid?: string;
    searchParams: Record<string, string>;
    rowsNumber: number;
    categories: string[];

    fileTypes: FileType[];

    constructor(
        page: number = DEFAULT_PAGINATION.page,
        take: number = DEFAULT_PAGINATION.rowsPerPage,
        sortBy: string = DEFAULT_SORT.sortBy,
        descending: boolean = DEFAULT_SORT.descending,
        projectUuid?: string,
        missionUuid?: string,
        searchParameters?: Record<string, string>,
        fileTypes?: FileType[],
        categories?: string[],
    ) {
        this.page = page;
        this.take = take;
        this.sortBy = sortBy;
        this.descending = descending;
        this.projectUuid = projectUuid ?? '';
        this.missionUuid = missionUuid ?? '';
        this.searchParams = searchParameters ?? DEFAULT_SEARCH;
        this.categories = categories ?? [];
        this.rowsNumber = 0;

        this.fileTypes = fileTypes ?? [...DEFAULT_FILE_TYPES];
    }

    get skip(): number {
        return (this.page - 1) * this.take;
    }

    /**
     * ---------------------------------------------
     * Setters handling the logic of resetting the pagination correctly
     * ---------------------------------------------
     * @param page
     */
    setPage(page: number): void {
        this.page = page;
    }

    setTake(take: number): void {
        if (this.take !== take) {
            this.take = take;
            this.page = DEFAULT_PAGINATION.page;
        }
    }

    setSort(sortBy: string): void {
        if (this.sortBy !== sortBy) {
            this.sortBy = sortBy;
            this.resetPagination();
        }
    }

    setDescending(descending: boolean): void {
        if (this.descending !== descending) {
            this.descending = descending;
            this.resetPagination();
        }
    }

    setProjectUUID(projectUuid: string | undefined): void {
        this.projectUuid = projectUuid ?? '';
        this.missionUuid = '';
        this.searchParams = DEFAULT_SEARCH;
        this.resetPagination();
    }

    setMissionUUID(missionUuid: string | undefined): void {
        this.missionUuid = missionUuid ?? '';
        this.searchParams = DEFAULT_SEARCH;
        this.resetPagination();
    }

    setSearch(searchParameters: Record<string, string>): void {
        const parametersChanged = Object.keys(searchParameters).some(
            (key) => this.searchParams[key] !== searchParameters[key],
        );

        if (parametersChanged) {
            this.searchParams = searchParameters;
            this.resetPagination();
        }
    }

    setFileTypes(fileTypes: FileType[]): void {
        this.fileTypes = fileTypes;
        this.resetPagination();
    }

    setCategories(categories: string[]): void {
        this.categories = categories;
        this.resetPagination();
    }

    addCategory(category: string): void {
        if (!this.categories.includes(category)) {
            this.categories.push(category);
            this.resetPagination();
        }
    }

    resetPagination(): void {
        this.page = DEFAULT_PAGINATION.page;
    }

    get isListingMissions(): boolean {
        return !!this.projectUuid && !this.missionUuid;
    }

    get isListingFiles(): boolean {
        return !!this.missionUuid;
    }

    /**
     * ---------------------------------------------
     * Part of each query key
     * ---------------------------------------------
     */
    get queryKey(): {
        searchParams: Record<string, string>;
        skip: number;
        take: number;
        sortBy: string;
        descending: boolean;
        fileTypes: FileType[];
        categories: string[];
    } {
        return {
            searchParams: this.searchParams,
            skip: this.skip,
            take: this.take,
            sortBy: this.sortBy,
            descending: this.descending,
            fileTypes: this.fileTypes,
            categories: this.categories,
        };
    }
}

/**
 * Extends the QueryHandler with the ability to read and write the query state to the URL
 */
export class QueryURLHandler extends QueryHandler {
    router: Router | undefined;
    internalUpdate = false;

    constructor(
        router?: Router,
        page?: number,
        take?: number,
        sortBy?: string,
        descending?: boolean,
        projectUuid?: string,
        missionUuid?: string,
        searchParameters?: typeof DEFAULT_SEARCH,
        fileTypes?: FileType[],
        categories?: string[],
    ) {
        super(
            page,
            take,
            sortBy,
            descending,
            projectUuid,
            missionUuid,
            searchParameters,
            fileTypes,
            categories,
        );
        if (router) {
            this.setRouter(router);
        }
    }

    /**
     * Once a router is set, the handler will listen to URL changes and update the query accordingly
     * @param router
     */
    setRouter(router: Router): void {
        this.router = router;
        watch(
            router.currentRoute,
            () => {
                if (!this.internalUpdate) {
                    this.readURL(router.currentRoute.value);
                }
            },
            { immediate: true },
        );
    }

    async safeWriteURL(): Promise<void> {
        try {
            await this.writeURL();
        } catch (error) {
            console.error('Failed to update URL:', error);
        }
    }

    /**
     * ---------------------------------------------
     * Setters that update the URL
     * ---------------------------------------------
     */
    override setPage(page: number): void {
        super.setPage(page);
        void this.safeWriteURL();
    }

    override setTake(take: number): void {
        super.setTake(take);
        void this.safeWriteURL();
    }

    override setSort(sortBy: string): void {
        super.setSort(sortBy);
        void this.safeWriteURL();
    }

    override setDescending(descending: boolean): void {
        super.setDescending(descending);
        void this.safeWriteURL();
    }

    override setProjectUUID(projectUuid: string | undefined): void {
        super.setProjectUUID(projectUuid);
        void this.safeWriteURL();
    }

    override setMissionUUID(missionUuid: string | undefined): void {
        super.setMissionUUID(missionUuid);
        void this.safeWriteURL();
    }

    override setSearch(searchParameters: Record<string, string>): void {
        super.setSearch(searchParameters);
        void this.safeWriteURL();
    }

    override setFileTypes(fileTypes: FileType[]): void {
        super.setFileTypes(fileTypes);
        void this.safeWriteURL();
    }

    override setCategories(categories: string[]): void {
        super.setCategories(categories);
        void this.safeWriteURL();
    }

    override addCategory(category: string): void {
        if (!this.categories.includes(category)) {
            super.addCategory(category);
            void this.safeWriteURL();
        }
    }

    /**
     * Read the current state of the URL and update the query accordingly
     * Values not set in the URL will be set to the default values
     */
    readURL(route: RouteLocationNormalizedLoaded): void {
        if (this.internalUpdate) {
            return;
        }
        this.page = route.query.page
            ? Number.parseInt(route.query.page as string)
            : DEFAULT_PAGINATION.page;
        this.take = route.query.rowsPerPage
            ? Number.parseInt(route.query.rowsPerPage as string)
            : DEFAULT_PAGINATION.rowsPerPage;
        if (route.query.sortBy) this.sortBy = route.query.sortBy as string;
        this.descending = route.query.descending
            ? route.query.descending === 'true'
            : DEFAULT_SORT.descending;
        this.projectUuid = route.query.projectUuid
            ? (route.query.projectUuid as string)
            : '';
        this.missionUuid = route.query.missionUuid
            ? (route.query.missionUuid as string)
            : '';

        const searchParameters = {} as Record<string, string>;

        // Reserved keys that are handled separately
        const reservedKeys = new Set([
            'page',
            'rowsPerPage',
            'sortBy',
            'descending',
            'projectUuid',
            'missionUuid',
            'file_type',
            'categories',
        ]);

        for (const key of Object.keys(route.query)) {
            if (!reservedKeys.has(key)) {
                const value = route.query[key];
                // We only support string filters for now (single value)
                if (typeof value === 'string') {
                    searchParameters[key] = value;
                }
            }
        }

        this.searchParams = searchParameters;

        const queryFileTypes = route.query.file_type as string | undefined;
        this.fileTypes =
            queryFileTypes && queryFileTypes.length > 0
                ? (queryFileTypes.split(',') as FileType[])
                : [...DEFAULT_FILE_TYPES];

        const queryCategories = route.query.categories;
        this.categories = queryCategories
            ? ((Array.isArray(queryCategories)
                  ? queryCategories
                  : [queryCategories]) as string[])
            : [];
    }

    /**
     * Write the current state of the query to the URL
     */
    async writeURL(): Promise<void> {
        if (!this.router) return;
        this.internalUpdate = true;

        // Logic to determine if fileTypes is in its default state
        const allFileTypesCount = Object.values(FileType).length;
        const isDefaultFileTypes =
            this.fileTypes.length === 0 ||
            this.fileTypes.length === allFileTypesCount;

        // Only write non default values to the URL
        const newQuery = {
            page:
                this.page === DEFAULT_PAGINATION.page
                    ? undefined
                    : this.page.toString(),
            rowsPerPage:
                this.take === DEFAULT_PAGINATION.rowsPerPage
                    ? undefined
                    : this.take.toString(),
            sortBy:
                this.sortBy === DEFAULT_SORT.sortBy ? undefined : this.sortBy,
            descending:
                this.descending === DEFAULT_SORT.descending
                    ? undefined
                    : this.descending.toString(),

            projectUuid: this.projectUuid ?? undefined,

            missionUuid: this.missionUuid ?? undefined,
            ...this.searchParams,

            // Join the array into a single comma-separated string
            // eslint-disable-next-line @typescript-eslint/naming-convention
            file_type: isDefaultFileTypes
                ? undefined
                : this.fileTypes.join(','),

            categories:
                this.categories.length > 0 ? this.categories : undefined,
        };

        const queries = this.router.currentRoute.value.query;
        const hasQueries = Object.keys(queries).length > 0;

        // Filter out undefined values from newQuery before pushing/replacing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalQuery: Record<string, any> = {};
        for (const [key, value] of Object.entries(newQuery)) {
            if (value !== undefined && value !== '') {
                finalQuery[key] = value;
            }
        }

        await (hasQueries
            ? this.router.push({ query: finalQuery })
            : this.router.replace({ query: finalQuery }));

        this.internalUpdate = false;
    }
}

export interface Pagination {
    page: number;
    rowsPerPage: number;
    sortBy: string;
    descending: boolean;
}

export interface TableRequest {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter?: any;
    pagination: Pagination;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getCellValue: any;
}
