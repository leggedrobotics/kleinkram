import axios from 'src/api/axios';
import { TagType } from 'src/types/TagType';

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

export const getFilteredTagTypes = async (name: string): Promise<TagType[]> => {
    let response;
    if (!name) {
        response = await axios.get('/tag/all');
    } else {
        response = await axios.get(`/tag/filtered?name=${name}`);
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
