import axios from 'src/api/axios';

export const createCategory = async (name: string, projectUUID: string) => {
    const response = await axios.post('/category/create', {
        name,
        projectUUID,
    });
    return response.data;
};
