import type { CategoriesDto } from '@kleinkram/api-dto/types/category.dto';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

export const getCategories = async (
    projectUUID: string,
    filter?: string,
): Promise<CategoriesDto> => {
    const parameters: {
        projectUuid: string;
        filter?: string;
    } = { projectUuid: projectUUID };
    if (filter) {
        parameters.filter = filter;
    }
    const response: AxiosResponse<CategoriesDto> = await axios.get(
        '/categories',
        {
            params: parameters,
        },
    );
    return response.data;
};
