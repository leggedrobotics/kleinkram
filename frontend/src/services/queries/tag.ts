import type {
    TagsDto,
    TagTypeDto,
} from '@kleinkram/api-dto/types/tags/tags.dto';
import { DataType } from '@kleinkram/shared';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

export const getTagTypes = async (): Promise<TagTypeDto[]> => {
    const response: AxiosResponse<TagsDto> = await axios.get('/tag/all');
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return response.data.data ?? [];
};

export const getFilteredTagTypes = async (
    name?: string,
    type?: DataType,
): Promise<TagsDto> => {
    let response: AxiosResponse<TagsDto>;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!name && type === null) {
        response = await axios.get<TagsDto>('/tag/all');
    } else {
        const parameters: Record<string, string | DataType> = {};
        if (name) {
            parameters.name = name;
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (type !== null) {
            parameters.type = type ?? '';
        }
        response = await axios.get<TagsDto>(`/tag/filtered`, {
            params: parameters,
        });
    }
    return response.data;
};
