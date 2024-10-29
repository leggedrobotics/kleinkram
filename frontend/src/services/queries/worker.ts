import axios from 'src/api/axios';
import { Worker } from 'src/types/Worker';

export async function allWorkers(): Promise<[Worker[], number]> {
    const response = await axios.get('/worker/all');
    const worker = response.data[0].map((_worker) => {
        return new Worker(
            _worker.uuid,
            _worker.identifier,
            _worker.hostname,
            new Date(_worker.createdAt),
            new Date(_worker.updatedAt),
            _worker.cpuMemory,
            _worker.gpuModel,
            _worker.gpuMemory,
            _worker.cpuCores,
            _worker.cpuModel,
            _worker.storage,
            _worker.lastSeen,
            _worker.reachable,
        );
    });
    return [worker, response.data[1]];
}
