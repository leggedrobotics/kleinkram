import { ActionWorkersDto } from '@api/types/action-workers.dto';
import { AxiosResponse } from 'axios';
import axios from 'src/api/axios';

export async function allWorkers(): Promise<ActionWorkersDto> {
    const response: AxiosResponse<ActionWorkersDto> =
        await axios.get('/worker/all');
    return response.data;
}
