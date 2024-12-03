export interface PaggedResponse<T> {
    data: T[];
    count: number;
    skip: number;
    take: number;
}
