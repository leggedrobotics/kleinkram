import axios from 'src/api/axios';
import { AxiosResponse } from 'axios';
import { WorkersDto } from '@api/types/Workers.dto';

export async function allWorkers(): Promise<WorkersDto> {
    const response: AxiosResponse<WorkersDto> = await axios.get('/worker/all');
    return response.data;
}
