import axios from 'src/api/axios';

export const allTopicsNames = async (): Promise<string[]> => {
    const response = await axios.get('/topic/names');
    return response.data.data;
};
