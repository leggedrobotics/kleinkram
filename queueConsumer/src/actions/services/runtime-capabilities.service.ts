import { Injectable } from '@nestjs/common';
import { RuntimeCapability } from '@common/types';
import os from 'node:os';

/**
 * The RuntimeCapabilitiesService class is responsible for providing
 * the runtime capabilities of the current environment.
 *
 * The runtime capabilities include information about the hardware
 * (e.g. GPU model, memory) available in the current environment.
 *
 */
@Injectable()
export class RuntimeCapabilitiesService {
    /**
     * Get the runtime capabilities of the current environment.
     *
     * @returns The runtime capabilities of the current environment.
     *
     */
    getRuntimeCapabilities(): RuntimeCapability {
        const gpu_model = {
            name: 'Nvidia',
            memory: 0,
            compute_capability: '',
        }; // no GPU
        const cpu_model = os.cpus()[0].model;
        return { gpu_model, cpu_model };
    }
}
