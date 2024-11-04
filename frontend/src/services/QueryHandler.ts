import { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import { FileType } from 'src/enums/FILE_ENUM';
import { watch } from 'vue';

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
    fileType?: FileType;
    rowsNumber: number;
    categories: string[];

    constructor(
        page: number = DEFAULT_PAGINATION.page,
        take: number = DEFAULT_PAGINATION.rowsPerPage,
        sortBy: string = DEFAULT_SORT.sortBy,
        descending: boolean = DEFAULT_SORT.descending,
        projectUuid?: string,
        missionUuid?: string,
        searchParams?: Record<string, string>,
        fileType?: FileType,
        categories: string[],
    ) {
        this.page = page;
        this.take = take;
        this.sortBy = sortBy;
        this.descending = descending;
        this.projectUuid = projectUuid;
        this.missionUuid = missionUuid;
        this.searchParams = searchParams || DEFAULT_SEARCH;
        this.fileType = fileType || FileType.ALL;
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
    setPage(page: number) {
        this.page = page;
    }

    setTake(take: number) {
        if (this.take !== take) {
            this.take = take;
            this.page = DEFAULT_PAGINATION.page;
        }
    }

    setSort(sortBy: string) {
        if (this.sortBy !== sortBy) {
            this.sortBy = sortBy;
            this.resetPagination();
        }
    }

    setDescending(descending: boolean) {
        if (this.descending !== descending) {
            this.descending = descending;
            this.resetPagination();
        }
    }

    setProjectUUID(projectUuid: string | undefined) {
        this.projectUuid = projectUuid;
        this.missionUuid = undefined;
        this.searchParams = DEFAULT_SEARCH;
        this.resetPagination();
    }

    setMissionUUID(missionUuid: string | undefined) {
        this.missionUuid = missionUuid;
        this.searchParams = DEFAULT_SEARCH;
        this.resetPagination();
    }

    setSearch(searchParams: Record<string, string>) {
        const paramsChanged = Object.keys(searchParams).some(
            (key) => this.searchParams[key] !== searchParams[key],
        );

        if (paramsChanged) {
            this.searchParams = searchParams;
            this.resetPagination();
        }
    }

    setFileType(fileType: FileType) {
        this.fileType = fileType;
        this.resetPagination();
    }

    setCategories(categories: string[]) {
        this.categories = categories;
        this.resetPagination();
    }

    addCategory(category: string) {
        if (!this.categories.includes(category)) {
            this.categories.push(category);
            this.resetPagination();
        }
    }

    resetPagination() {
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
    internalUpdate: boolean = false;

    constructor(
        router?: Router,
        page?: number,
        take?: number,
        sortBy?: string,
        descending?: boolean,
        projectUuid?: string,
        missionUuid?: string,
        searchParams?: typeof DEFAULT_SEARCH,
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
            searchParams,
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
    setPage(page: number) {
        super.setPage(page);
        this.writeURL();
    }

    setTake(take: number) {
        super.setTake(take);
        this.writeURL();
    }

    setSort(sortBy: string) {
        super.setSort(sortBy);
        this.writeURL();
    }

    setDescending(descending: boolean) {
        super.setDescending(descending);
        this.writeURL();
    }

    setProjectUUID(projectUuid: string | undefined) {
        super.setProjectUUID(projectUuid);
        this.writeURL();
    }

    setMissionUUID(missionUuid: string | undefined) {
        super.setMissionUUID(missionUuid);
        this.writeURL();
    }

    setSearch(searchParams: Record<string, string>) {
        super.setSearch(searchParams);
        this.writeURL();
    }

    setFileType(fileType: FileType) {
        super.setFileType(fileType);
        this.writeURL();
    }

    setCategories(categories: string[]) {
        super.setCategories(categories);
        this.writeURL();
    }

    addCategory(category: string) {
        if (!this.categories.includes(category)) {
            super.addCategory(category);
            this.writeURL();
        }
    }

    /**
     * Read the current state of the URL and update the query accordingly
     * Values not set in the URL will be set to the default values
     */
    readURL(route: RouteLocationNormalizedLoaded) {
        if (this.internalUpdate) {
            return;
        }
        if (route.query.page) this.page = parseInt(route.query.page as string);
        else this.page = DEFAULT_PAGINATION.page;
        if (route.query.rowsPerPage)
            this.take = parseInt(route.query.rowsPerPage as string);
        else this.take = DEFAULT_PAGINATION.rowsPerPage;
        if (route.query.sortBy) this.sortBy = route.query.sortBy as string;
        if (route.query.descending)
            this.descending = route.query.descending === 'true';
        else this.descending = DEFAULT_SORT.descending;
        if (route.query.project_uuid)
            this.projectUuid = route.query.project_uuid as string;
        else this.projectUuid = undefined;
        if (route.query.mission_uuid)
            this.missionUuid = route.query.mission_uuid as string;
        else this.missionUuid = undefined;

        const searchParams = {} as Record<string, string>;
        if (route.query.name) searchParams['name'] = route.query.name as string;
        if (route.query.health)
            searchParams['health'] = route.query.health as string;
        if (searchParams) this.searchParams = searchParams;
        else this.searchParams = DEFAULT_SEARCH;
        if (route.query.file_type)
            this.fileType = route.query.file_type as FileType;
        else this.fileType = DEFAULT_FILE_TYPE;
        if (route.query.categories) {
            if (Array.isArray(route.query.categories))
                this.categories = route.query.categories as string[];
            else {
                this.categories = [route.query.categories];
            }
        }
    }

    /**
     * Write the current state of the query to the URL
     */
    writeURL() {
        if (!this.router) return;
        this.internalUpdate = true;

        // Only write non default values to the URL
        const newQuery = {
            page:
                this.page !== DEFAULT_PAGINATION.page
                    ? this.page.toString()
                    : undefined,
            rowsPerPage:
                this.take !== DEFAULT_PAGINATION.rowsPerPage
                    ? this.take.toString()
                    : undefined,
            sortBy:
                this.sortBy !== DEFAULT_SORT.sortBy ? this.sortBy : undefined,
            descending:
                this.descending !== DEFAULT_SORT.descending
                    ? this.descending.toString()
                    : undefined,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            project_uuid: this.projectUuid || undefined,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            mission_uuid: this.missionUuid || undefined,
            ...this.searchParams,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            file_type:
                !!this.fileType && this.fileType !== FileType.ALL
                    ? this.fileType || undefined
                    : undefined,
            categories:
                this.categories.length > 0 ? this.categories : undefined,
        };
        this.router.push({ query: newQuery });
        this.internalUpdate = false;
    }
}

export type TableRequest = {
    filter?: any;
    pagination: {
        page: number;
        rowsPerPage: number;
        sortBy: string;
        descending: boolean;
    };
    getCellValue: any;
};
