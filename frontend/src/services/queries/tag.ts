import { TagsDto, TagTypeDto } from '@api/types/tags/tags.dto';
import { DataType } from '@common/enum';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

export const getTagTypes = async (): Promise<TagTypeDto[]> => {
    const response: AxiosResponse<TagsDto> = await axios.get('/tag/all');
    return response.data.data ?? [];
};

export const getFilteredTagTypes = async (
    name?: string,
    type?: DataType,
): Promise<TagsDto> => {
    let response: AxiosResponse<TagsDto>;
    if (!name && type === null) {
        response = await axios.get<TagsDto>('/tag/all');
    } else {
        const parameters: Record<string, string | DataType> = {};
        if (name) {
            parameters.name = name;
        }
        if (type !== null) {
            parameters.type = type ?? '';
        }
        response = await axios.get<TagsDto>(`/tag/filtered`, {
            params: parameters,
        });
    }
    return response.data;
};
