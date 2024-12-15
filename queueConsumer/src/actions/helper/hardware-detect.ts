import si from 'systeminformation';
import { Repository } from 'typeorm';
import Worker from '@common/entities/worker/worker.entity';
import fs from 'node:fs';
import Docker from 'dockerode';
import logger from '../../logger';
import { promisify } from 'node:util';

export async function getDiskSpace() {
    const diskData = await si.fsSize();
    let totalAvailable = 0;

    for (const disk of diskData) {
        if (disk.type !== 'overlay') {
            totalAvailable += disk.available;
        }
    }

    // Convert bytes to GB
    return Math.round(totalAvailable / (1024 * 1024 * 1024));
}

export async function createWorker(
    workerRepository: Repository<Worker>,
): Promise<Worker> {
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
    const gpuModel = (hasGPU && gpuModels[0]) ?? '';
    const gpuMemory = hasGPU ? 1000 : -1; // Not available in the current implementation

    // Gather Disk storage information
    const storage = await getDiskSpace();

    // Gather Hostname (assuming this will be the worker's unique name)
    const { hostname: name } = await si.osInfo();

    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    const info = await docker.info();
    const hostname = info.Name;

    // Assume "reachable" is true since we're creating the worker entity on the current machine
    const reachable = true;

    // Create and save the Worker entity
    return workerRepository.create({
        identifier: name,
        hostname,
        cpuMemory,
        gpuModel,
        gpuMemory,
        cpuCores,
        cpuModel,
        storage,
        reachable,
        lastSeen: new Date(),
        actions: [],
    });
}

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

const getGpuModels = async () => {
    const path = '/proc/driver/nvidia/gpus/';

    try {
        // verify if docker socket has nvidia runtime
        // if not, return empty array
        const docker = new Docker({ socketPath: '/var/run/docker.sock' });
        const info = await docker.info();
        const runtimes = info.Runtimes;
        const hasNvidiaRuntime =
            Boolean(runtimes) && runtimes.nvidia !== undefined;
        if (!hasNvidiaRuntime) {
            logger.debug('No NVIDIA runtime found in Docker');
            return [];
        }

        // extract GPU model information from the files in the /proc/driver/nvidia/gpus/ directory
        const files = await readdir(path);
        const modelPromises = files.map(async (file) => {
            const filepath = `${path}${file}/information`;
            try {
                const fileContent = await readFile(filepath, 'utf8');
                const modelRegex = /Model:\s*(.*)/;
                const match = modelRegex.exec(fileContent);
                if (match?.[1]) {
                    return match[1].trim();
                }
                return null; // In case the model information is not found
            } catch (error: unknown) {
                let errorMessage = '';

                if (error instanceof Error) {
                    errorMessage = error.message;
                }

                logger.error(`Error reading file ${filepath}: ${errorMessage}`);
                return null;
            }
        });

        // Wait for all promises to resolve and filter out null values
        const models = await Promise.all(modelPromises);
        return models.filter((model) => model !== null);
    } catch (error: unknown) {
        let errorMessage = '';

        if (error instanceof Error) {
            errorMessage = error.message;
        }

        logger.error(`Error reading NVIDIA GPU data: ${errorMessage}`);
        return [];
    }
};
