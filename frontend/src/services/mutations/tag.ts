import { DataType } from '@kleinkram/shared';
import axios from 'src/api/axios';

export const removeTag = async (tagUUID: string) => {
    const response = await axios.delete('/tag/deleteTag', {
        params: { uuid: tagUUID },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const addTags = async (
    missionUUID: string,
    tags: Record<string, string>,
) => {
    const response = await axios.post('/tag/addTags', {
        mission: missionUUID,
        tags,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const createTagType = async (name: string, type: DataType) => {
    const response = await axios.post('/tag/create', { name, type });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};
