import axios from 'src/api/axios';
import { AxiosResponse } from 'axios';
import { ActionWorkersDto } from '@api/types/action-workers.dto';

export async function allWorkers(): Promise<ActionWorkersDto> {
    const response: AxiosResponse<ActionWorkersDto> =
        await axios.get('/worker/all');
    return response.data;
}
