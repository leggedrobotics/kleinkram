import { Injectable } from '@nestjs/common';
import si from 'systeminformation';

/**
 * Service for monitoring system resources and providing system information.
 * Wraps `systeminformation` to provide a clean interface for other services.
 */
@Injectable()
export class ResourceMonitorService {
    /**
     * Get the hostname of the current machine.
     */
    async getHostname(): Promise<string> {
        const osInfo = await si.osInfo();
        return osInfo.hostname;
    }

    /**
     * Get full OS information.
     */
    async getOsInfo(): Promise<si.Systeminformation.OsData> {
        return si.osInfo();
    }

    // Future: Add CPU/Memory load checks here
    // async checkAvailableResources(): Promise<{ cpuAvailable: boolean; memoryAvailable: boolean }> { ... }
}
