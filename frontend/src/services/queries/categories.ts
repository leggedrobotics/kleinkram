import { CategoriesDto } from '@api/types/category.dto';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

export const getCategories = async (
    projectUUID: string,
    filter?: string,
): Promise<CategoriesDto> => {
    const parameters: {
        uuid: string;
        filter?: string;
    } = { uuid: projectUUID };
    if (filter) {
        parameters.filter = filter;
    }
    const response: AxiosResponse<CategoriesDto> = await axios.get(
        '/category/all',
        {
            params: parameters,
        },
    );
    return response.data;
};
