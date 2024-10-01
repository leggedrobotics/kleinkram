import axios from 'src/api/axios';
import { Worker } from 'src/types/Worker';

export async function allWorkers(): Promise<[Worker[], number]> {
    const response = await axios.get('/worker/all');
    const worker = response.data[0].map((worker) => {
        return new Worker(
            worker.uuid,
            worker.identifier,
            worker.hostname,
            new Date(worker.createdAt),
            new Date(worker.updatedAt),
            new Date(worker.deletedAt),
            worker.cpuMemory,
            worker.hasGPU,
            worker.gpuModel,
            worker.gpuMemory,
            worker.cpuCores,
            worker.cpuModel,
            worker.storage,
            worker.lastSeen,
            worker.reachable,
        );
    });
    return [worker, response.data[1]];
}
