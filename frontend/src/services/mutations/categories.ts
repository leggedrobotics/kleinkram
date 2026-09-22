import axios from 'src/api/axios';

export const createCategory = async (
    name: string,
    projectUUID: string,
    description = '',
) => {
    const response = await axios.post('/categories', {
        name,
        projectUUID,
        description,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const updateCategoryDescription = async (
    uuid: string,
    projectUUID: string,
    description: string,
) => {
    const response = await axios.put(`/categories/${uuid}`, {
        projectUUID,
        description,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const addManyCategories = async (
    missionUUID: string,
    files: string[],
    categories: string[],
) => {
    const response = await axios.post('/categories/add-many', {
        missionUUID,
        files,
        categories,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};
