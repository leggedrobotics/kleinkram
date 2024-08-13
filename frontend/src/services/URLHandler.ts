import { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import { FileType } from 'src/enums/FILE_ENUM';
import { watch } from 'vue';

const DEFAULT_SORT = { sortBy: 'name', descending: false };
const DEFAULT_PAGINATION = { page: 1, rowsPerPage: 10 };
const DEFAULT_SEARCH = { name: '' };
const DEFAULT_FILE_TYPE = FileType.MCAP;

/**
 * Class passed around to handle the query state
 * Contains logic for pagination, sorting, filtering and the current data type
 */
export class QueryHandler {
    page: number;
    take: number;
    sortBy: string;
    descending: boolean;
    mission_uuid?: string;
    project_uuid?: string;
    search_params: typeof DEFAULT_SEARCH;
    file_type?: FileType;
    rowsNumber: number;
    default_sort: string;

    constructor(
        page: number = DEFAULT_PAGINATION.page,
        take: number = DEFAULT_PAGINATION.rowsPerPage,
        sortBy: string = DEFAULT_SORT.sortBy,
        descending: boolean = DEFAULT_SORT.descending,
        project_uuid?: string,
        mission_uuid?: string,
        search_params?: typeof DEFAULT_SEARCH,
        file_type?: FileType,
    ) {
        this.page = page;
        this.take = take;
        this.sortBy = sortBy;
        this.default_sort = sortBy;
        this.descending = descending;
        this.project_uuid = project_uuid;
        this.mission_uuid = mission_uuid;
        this.search_params = search_params || DEFAULT_SEARCH;
        this.file_type = file_type || DEFAULT_FILE_TYPE;
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

    setProjectUUID(project_uuid: string | undefined) {
        this.project_uuid = project_uuid;
        this.mission_uuid = undefined;
        this.search_params = DEFAULT_SEARCH;
        this.resetPagination();
    }

    setMissionUUID(mission_uuid: string | undefined) {
        this.mission_uuid = mission_uuid;
        this.search_params = DEFAULT_SEARCH;
        this.resetPagination();
    }

    setSearch(search_params: { name: string }) {
        if (this.search_params.name !== search_params.name) {
            this.search_params = search_params;
            this.resetPagination();
        }
    }

    setFileType(file_type: FileType) {
        this.file_type = file_type;
        this.resetPagination();
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
        return !this.project_uuid && !this.mission_uuid;
    }

    get isListingMissions() {
        return !!this.project_uuid && !this.mission_uuid;
    }

    get isListingFiles() {
        return !!this.mission_uuid;
    }

    /**
     * ---------------------------------------------
     * Part of each query key
     * ---------------------------------------------
     */
    get queryKey() {
        return {
            search_params: this.search_params,
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
    internal_update: boolean = false;

    constructor(
        router?: Router,
        page?: number,
        take?: number,
        sortBy?: string,
        descending?: boolean,
        project_uuid?: string,
        mission_uuid?: string,
        search_params?: typeof DEFAULT_SEARCH,
        file_type?: FileType,
    ) {
        super(
            page,
            take,
            sortBy,
            descending,
            project_uuid,
            mission_uuid,
            search_params,
            file_type,
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
                if (!this.internal_update) {
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

    setProjectUUID(project_uuid: string | undefined) {
        super.setProjectUUID(project_uuid);
        this.writeURL();
    }

    setMissionUUID(mission_uuid: string | undefined) {
        super.setMissionUUID(mission_uuid);
        this.writeURL();
    }

    setSearch(search_params: typeof DEFAULT_SEARCH) {
        super.setSearch(search_params);
        this.writeURL();
    }

    setFileType(file_type: FileType) {
        super.setFileType(file_type);
        this.writeURL();
    }

    /**
     * Read the current state of the URL and update the query accordingly
     * Values not set in the URL will be set to the default values
     */
    readURL(route: RouteLocationNormalizedLoaded) {
        if (this.internal_update) {
            return;
        }
        if (route.query.page) this.page = parseInt(route.query.page as string);
        else this.page = DEFAULT_PAGINATION.page;
        if (route.query.rowsPerPage)
            this.take = parseInt(route.query.rowsPerPage as string);
        else this.take = DEFAULT_PAGINATION.rowsPerPage;
        if (route.query.sortBy) this.sortBy = route.query.sortBy as string;
        else this.sortBy = this.default_sort;
        if (route.query.descending)
            this.descending = route.query.descending === 'true';
        else this.descending = DEFAULT_SORT.descending;
        if (route.query.project_uuid)
            this.project_uuid = route.query.project_uuid as string;
        else this.project_uuid = undefined;
        if (route.query.mission_uuid)
            this.mission_uuid = route.query.mission_uuid as string;
        else this.mission_uuid = undefined;
        if (route.query.name)
            this.search_params = { name: route.query.name as string };
        else this.search_params = DEFAULT_SEARCH;
        if (route.query.file_type)
            this.file_type = route.query.file_type as FileType;
        else this.file_type = DEFAULT_FILE_TYPE;
    }

    /**
     * Write the current state of the query to the URL
     */
    writeURL() {
        if (!this.router) return;
        this.internal_update = true;

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
            project_uuid: this.project_uuid || undefined,
            mission_uuid: this.mission_uuid || undefined,
            name: this.search_params?.name || undefined,
            file_type:
                this.project_uuid && this.mission_uuid
                    ? this.file_type || undefined
                    : undefined,
        };
        this.router.push({ query: newQuery });
        this.internal_update = false;
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
