import si from 'systeminformation';
import { Repository } from 'typeorm';
import Worker from '@common/entities/worker/worker.entity';

export async function createWorker(workerRepository: Repository<Worker>) {
    // Gather CPU information
    const cpuData = await si.cpu();
    const cpuCores = cpuData.cores;
    const cpuModel = cpuData.brand;

    // Gather Memory information (in bytes, convert to GB)
    const memoryData = await si.mem();
    const cpuMemory = Math.round(memoryData.total / (1024 * 1024 * 1024)); // Convert bytes to GB

    // Gather GPU information
    const gpuData = await si.graphics();
    const hasGPU = gpuData.controllers.length > 0;
    const gpuModel = hasGPU ? gpuData.controllers[0].model : null;
    const gpuMemory = hasGPU ? gpuData.controllers[0].vram / 1024 : 0; // VRAM in MB, convert to GB

    // Gather Disk storage information
    const diskData = await si.fsSize();
    console.log(diskData);
    const storage = Math.round(
        diskData.reduce(
            (acc, disk) =>
                disk.type === 'overlay' ? acc : acc + disk.available,
            0,
        ) /
            (1024 * 1024 * 1024),
    ); // Convert bytes to GB

    // Gather Hostname (assuming this will be the worker's unique name)
    const hostname = await si.osInfo();
    const name = hostname.hostname;

    // Assume "reachable" is true since we're creating the worker entity on the current machine
    const reachable = true;

    // Create and save the Worker entity
    const newWorker = workerRepository.create({
        name,
        cpuMemory,
        hasGPU,
        gpuModel,
        gpuMemory,
        cpuCores,
        cpuModel,
        storage,
        reachable,
        lastSeen: new Date(),
    });
    return await workerRepository.save(newWorker);
}
