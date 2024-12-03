import { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import { watch } from 'vue';
import { FileType } from '@common/enum';

const DEFAULT_SORT = { sortBy: 'name', descending: false };
const DEFAULT_PAGINATION = { page: 1, rowsPerPage: 20 };
const DEFAULT_SEARCH = {};
const DEFAULT_FILE_TYPE = FileType.ALL;

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
    fileType?: boolean | FileType;
    rowsNumber: number;
    categories: string[];

    constructor(
        page: number = DEFAULT_PAGINATION.page,
        take: number = DEFAULT_PAGINATION.rowsPerPage,
        sortBy: string = DEFAULT_SORT.sortBy,
        descending: boolean = DEFAULT_SORT.descending,
        projectUuid?: string,
        missionUuid?: string,
        searchParameters?: Record<string, string>,
        fileType?: FileType,
        categories?: string[],
    ) {
        this.page = page;
        this.take = take;
        this.sortBy = sortBy;
        this.descending = descending;
        this.projectUuid = projectUuid;
        this.missionUuid = missionUuid;
        this.searchParams = searchParameters || DEFAULT_SEARCH;
        this.fileType = fileType !== null || FileType.ALL;
        this.categories = categories || [];
        this.rowsNumber = 0;
    }

    get skip() {
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
        this.projectUuid = projectUuid;
        this.missionUuid = undefined;
        this.searchParams = DEFAULT_SEARCH;
        this.resetPagination();
    }

    setMissionUUID(missionUuid: string | undefined): void {
        this.missionUuid = missionUuid;
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

    setFileType(fileType: FileType): void {
        this.fileType = fileType;
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

    /**
     * ---------------------------------------------
     * Which data type is currently being displayed
     * ---------------------------------------------
     */
    get isListingProjects() {
        return !this.projectUuid && !this.missionUuid;
    }

    get isListingMissions() {
        return !!this.projectUuid && !this.missionUuid;
    }

    get isListingFiles() {
        return !!this.missionUuid;
    }

    /**
     * ---------------------------------------------
     * Part of each query key
     * ---------------------------------------------
     */
    get queryKey() {
        return {
            searchParams: this.searchParams,
            skip: this.skip,
            take: this.take,
            sortBy: this.sortBy,
            descending: this.descending,
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
        fileType?: FileType,
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
            fileType,
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
    setRouter(router: Router) {
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

    /**
     * ---------------------------------------------
     * Setters that update the URL
     * ---------------------------------------------
     */
    setPage(page: number): void {
        super.setPage(page);
        this.writeURL().catch((error: unknown) => {
            console.error(error);
        });
    }

    setTake(take: number): void {
        super.setTake(take);
        this.writeURL().catch((error: unknown) => {
            console.error(error);
        });
    }

    setSort(sortBy: string): void {
        super.setSort(sortBy);
        this.writeURL().catch((error: unknown) => {
            console.error(error);
        });
    }

    setDescending(descending: boolean): void {
        super.setDescending(descending);
        this.writeURL().catch((error: unknown) => {
            console.error(error);
        });
    }

    setProjectUUID(projectUuid: string | undefined): void {
        super.setProjectUUID(projectUuid);
        this.writeURL().catch((error: unknown) => {
            console.error(error);
        });
    }

    setMissionUUID(missionUuid: string | undefined): void {
        super.setMissionUUID(missionUuid);
        this.writeURL().catch((error: unknown) => {
            console.error(error);
        });
    }

    setSearch(searchParameters: Record<string, string>): void {
        super.setSearch(searchParameters);
        this.writeURL().catch((error: unknown) => {
            console.error(error);
        });
    }

    setFileType(fileType: FileType): void {
        super.setFileType(fileType);
        this.writeURL().catch((error: unknown) => {
            console.error(error);
        });
    }

    setCategories(categories: string[]): void {
        super.setCategories(categories);
        this.writeURL().catch((error: unknown) => {
            console.error(error);
        });
    }

    addCategory(category: string): void {
        if (!this.categories.includes(category)) {
            super.addCategory(category);
            this.writeURL().catch((error: unknown) => {
                console.error(error);
            });
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
        this.projectUuid = route.query.project_uuid
            ? (route.query.project_uuid as string)
            : undefined;
        this.missionUuid = route.query.mission_uuid
            ? (route.query.mission_uuid as string)
            : undefined;

        const searchParameters = {} as Record<string, string>;
        if (route.query.name)
            searchParameters.name = route.query.name as string;
        if (route.query.health)
            searchParameters.health = route.query.health as string;
        this.searchParams = searchParameters
            ? searchParameters
            : DEFAULT_SEARCH;
        this.fileType = route.query.file_type
            ? (route.query.file_type as FileType)
            : DEFAULT_FILE_TYPE;
        if (route.query.categories) {
            this.categories = Array.isArray(route.query.categories)
                ? (route.query.categories as string[])
                : [route.query.categories];
        }
    }

    /**
     * Write the current state of the query to the URL
     */
    async writeURL(): Promise<void> {
        if (!this.router) return;
        this.internalUpdate = true;

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

            project_uuid: this.projectUuid || undefined,

            mission_uuid: this.missionUuid || undefined,
            ...this.searchParams,

            file_type:
                !(this.fileType === null) && this.fileType !== FileType.ALL
                    ? this.fileType || undefined
                    : undefined,
            categories:
                this.categories.length > 0 ? this.categories : undefined,
        };

        // check if any query was set before writing to the URL
        const queries = this.router.currentRoute.value.query;
        const hasQueries = Object.keys(queries).length > 0;
        if (hasQueries) {
            // @ts-ignore
            await this.router.push({ query: newQuery });
        } else {
            // @ts-ignore
            await this.router.replace({ query: newQuery });
        }

        this.internalUpdate = false;
    }
}

export interface TableRequest {
    filter?: any;
    pagination: {
        page: number;
        rowsPerPage: number;
        sortBy: string;
        descending: boolean;
    };
    getCellValue: any;
}
