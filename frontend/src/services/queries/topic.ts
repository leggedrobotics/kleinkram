import axios from 'src/api/axios';

export const allTopicsNames = async (): Promise<string[]> => {
    const response = await axios.get('/topic/names');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return response.data.data;
};
