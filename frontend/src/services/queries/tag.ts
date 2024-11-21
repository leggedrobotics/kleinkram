import axios from 'src/api/axios';
import { DataType } from '@common/enum';

export const getTagTypes = async () => {
    const response = await axios.get('/tag/all');
    return response.data;
};

export const getFilteredTagTypes = async (
    name?: string,
    type?: DataType,
): Promise<TagType[]> => {
    let response;
    if (!name && type == null) {
        response = await axios.get('/tag/all');
    } else {
        const params: Record<string, string | DataType> = {};
        if (name) {
            params.name = name;
        }
        if (type != null) {
            params.type = type;
        }
        response = await axios.get(`/tag/filtered`, { params });
    }
    return response.data;
};
