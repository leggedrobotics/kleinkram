import axios from 'src/api/axios';
import { Tag } from 'src/types/Tag';
import { DataType } from '@common/enum';

export const removeTag = async (tagUUID: string) => {
    const response = await axios.delete('/tag/deleteTag', {
        params: { uuid: tagUUID },
    });
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
    return response.data;
};

export const createTagType = async (name: string, type: DataType) => {
    const response = await axios.post('/tag/create', { name, type });
    return new Tag(
        response.data.uuid,
        response.data.STRING,
        response.data.NUMBER,
        response.data.BOOLEAN,
        response.data.DATE,
        response.data.LOCATION,
        response.data.type,
        new Date(response.data.createdAt),
        new Date(response.data.updatedAt),
    );
};
