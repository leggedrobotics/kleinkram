import axios from 'src/api/axios';
import { Category } from 'src/types/Category';

export const getCategories = async (projectUUID: string, filter?: string) => {
    const params = { uuid: projectUUID };
    if (filter) {
        params['filter'] = filter;
    }
    const response = await axios.get('/category/all', {
        params,
    });
    const cats = response.data[0].map((res: any) => {
        return new Category(
            res.uuid,
            res.createdAt,
            res.updatedAt,
            res.deletedAt,
            res.name,
            undefined,
            [],
        );
    });
    return [cats, response.data[1]];
};
