import axios from 'src/api/axios';
import { TagType } from 'src/types/TagType';
import { DataType } from 'src/enums/TAG_TYPES';

export const getTagTypes = async () => {
    const response = await axios.get('/tag/all');
    return response.data.map((tag: any) => {
        return new TagType(
            tag.uuid,
            tag.name,
            tag.datatype,
            new Date(tag.createdAt),
            new Date(tag.updatedAt),
            new Date(tag.deletedAt),
        );
    });
};

export const getFilteredTagTypes = async (
    name?: string,
    type?: DataType,
): Promise<TagType[]> => {
    let response;
    if (!name && !type) {
        response = await axios.get('/tag/all');
    } else {
        const params: Record<string, string | DataType> = {};
        if (name) {
            params['name'] = name;
        }
        if (type && type !== DataType.ANY) {
            params['type'] = type;
        }
        response = await axios.get(`/tag/filtered`, { params });
    }
    return response.data.map((tag: any) => {
        return new TagType(
            tag.uuid,
            tag.name,
            tag.datatype,
            new Date(tag.createdAt),
            new Date(tag.updatedAt),
            new Date(tag.deletedAt),
        );
    });
};
