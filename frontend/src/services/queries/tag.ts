import axios from 'src/api/axios';
import { DataType } from '@common/enum';
import { TagsDto } from '@api/types/TagsDto.dto';
import { AxiosResponse } from 'axios';

export const getTagTypes = async (): Promise<TagsDto> => {
    const response: AxiosResponse<TagsDto> = await axios.get('/tag/all');
    return response.data;
};

export const getFilteredTagTypes = async (
    name?: string,
    type?: DataType,
): Promise<TagsDto> => {
    let response: AxiosResponse<TagsDto>;
    if (!name && type === null) {
        response = await axios.get<TagsDto>('/tag/all');
    } else {
        const params: Record<string, string | DataType> = {};
        if (name) {
            params.name = name;
        }
        if (type !== null) {
            params.type = type ?? '';
        }
        response = await axios.get<TagsDto>(`/tag/filtered`, { params });
    }
    return response.data;
};
