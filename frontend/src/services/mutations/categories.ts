import axios from 'src/api/axios';

export const createCategory = async (name: string, projectUUID: string) => {
    const response = await axios.post('/category/create', {
        name,
        projectUUID,
    });
    return response.data;
};

export const addManyCategories = async (
    missionUUID: string,
    files: string[],
    categories: string[],
) => {
    const response = await axios.post('/category/addMany', {
        missionUUID,
        files,
        categories,
    });
    return response.data;
};
