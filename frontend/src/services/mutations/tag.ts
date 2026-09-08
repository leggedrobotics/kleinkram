import { DataType } from '@kleinkram/shared';
import axios from 'src/api/axios';

export const removeTag = async (tagUUID: string) => {
    const response = await axios.delete(`/metadata/${tagUUID}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const addTags = async (
    missionUUID: string,
    tags: Record<string, string>,
) => {
    const response = await axios.post(`/missions/${missionUUID}/metadata`, {
        metadata: tags,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};

export const createTagType = async (name: string, type: DataType) => {
    const response = await axios.post('/metadata-types', { name, type });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};
