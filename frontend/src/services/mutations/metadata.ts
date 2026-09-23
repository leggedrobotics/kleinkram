import { DataType } from '@kleinkram/shared';
import axios from 'src/api/axios';

export const createMetadataType = async (name: string, type: DataType) => {
    const response = await axios.post('/metadata-types', { name, type });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data;
};
