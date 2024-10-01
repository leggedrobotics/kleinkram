import si from 'systeminformation';
import { Repository } from 'typeorm';
import Worker from '@common/entities/worker/worker.entity';
import fs from 'fs';
import Docker from 'dockerode';
const util = require('util');

export async function createWorker(workerRepository: Repository<Worker>) {
    // Gather CPU information
    const cpuData = await si.cpu();
    const cpuCores = cpuData.cores;
    const cpuModel = cpuData.brand;

    // Gather Memory information (in bytes, convert to GB)
    const memoryData = await si.mem();
    const cpuMemory = Math.round(memoryData.total / (1024 * 1024 * 1024)); // Convert bytes to GB

    // Gather GPU information
    const gpuModels = await getGpuModels();
    const hasGPU = gpuModels.length > 0;
    const gpuModel = hasGPU ? gpuModels[0] : null;
    const gpuMemory = 0; // Not available in the current implementation

    // Gather Disk storage information
    const diskData = await si.fsSize();
    const storage = Math.round(
        diskData.reduce(
            (acc, disk) =>
                disk.type === 'overlay' ? acc : acc + disk.available,
            0,
        ) /
            (1024 * 1024 * 1024),
    ); // Convert bytes to GB

    // Gather Hostname (assuming this will be the worker's unique name)
    const name = (await si.osInfo()).hostname;

    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    const info = await docker.info();
    const hostname = info.Name;

    // Assume "reachable" is true since we're creating the worker entity on the current machine
    const reachable = true;

    // Create and save the Worker entity
    const newWorker = workerRepository.create({
        identifier: name,
        hostname,
        cpuMemory,
        hasGPU,
        gpuModel,
        gpuMemory,
        cpuCores,
        cpuModel,
        storage,
        reachable,
        lastSeen: new Date(),
        actions: [],
    });
    return await workerRepository.save(newWorker);
}

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);

const getGpuModels = async () => {
    const path = '/proc/driver/nvidia/gpus/';

    try {
        const files = await readdir(path);
        const modelPromises = files.map(async (file) => {
            const filepath = `${path}${file}/information`;
            try {
                const fileContent = await readFile(filepath, 'utf8');
                const modelRegex = /Model:\s*(.*)/;
                const match = fileContent.match(modelRegex);
                if (match && match[1]) {
                    return match[1].trim();
                }
                return null; // In case the model information is not found
            } catch (err) {
                console.error('Error reading file:', err);
                return null;
            }
        });

        // Wait for all promises to resolve and filter out null values
        const models = await Promise.all(modelPromises);
        return models.filter((model) => model !== null);
    } catch (err) {
        console.error('Error reading NVIDIA GPU data:', err);
        return [];
    }
};
