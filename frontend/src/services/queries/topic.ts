import axios from 'src/api/axios';

export const allTopics = async () => {
    const response = await axios.get('/topic/all');
    return response.data;
};

export const allTopicsNames = async (): Promise<string[]> => {
    const response = await axios.get('/topic/names');
    return response.data;
};
