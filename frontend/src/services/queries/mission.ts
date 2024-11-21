import axios from 'src/api/axios';

export const getMission = async (uuid: string): Promise<Mission> => {
    const response = await axios.get('/mission/one', { params: { uuid } });
    return response.data;
};

export const missionsOfProjectMinimal = async (
    projectUUID: string,
    take = 100,
    skip = 0,
    sortBy = 'createdAt',
    descending = false,
    searchParams?: {
        name: string;
    },
): Promise<[Mission[], number]> => {
    if (!projectUUID) {
        return [[], 0];
    }
    const params: Record<string, any> = {
        uuid: projectUUID,
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };
    if (searchParams?.name) {
        params.search = searchParams.name;
    }
    const response = await axios.get(`/mission/filteredMinimal`, {
        params,
    });
    return response.data;
};

export const missionsOfProject = async (
    projectUUID: string,
    take = 100,
    skip = 0,
    sortBy = 'createdAt',
    descending = false,
    searchParams?: {
        name: string;
    },
): Promise<[Mission[], number]> => {
    if (!projectUUID) {
        return [[], 0];
    }
    const params: Record<string, any> = {
        uuid: projectUUID,
        take,
        skip,
        sortBy,
        sortDirection: descending ? 'DESC' : 'ASC',
    };
    if (searchParams?.name) {
        params.search = searchParams.name;
    }
    const response = await axios.get(`/mission/filtered`, {
        params,
    });
    return response.data;
};

export const getMissions = async (uuids: string[]): Promise<Mission[]> => {
    const response = await axios.get('/mission/many', { params: { uuids } });
    return response.data;
};
