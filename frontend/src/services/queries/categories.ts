import axios from 'src/api/axios';
import { AxiosResponse } from 'axios';
import { CategoriesDto } from '@api/types/Category.dto';

export const getCategories = async (
    projectUUID: string,
    filter?: string,
): Promise<CategoriesDto> => {
    const params: {
        uuid: string;
        filter?: string;
    } = { uuid: projectUUID };
    if (filter) {
        params.filter = filter;
    }
    const response: AxiosResponse<CategoriesDto> = await axios.get(
        '/category/all',
        {
            params,
        },
    );
    return response.data;
};
