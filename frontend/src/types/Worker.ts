import { BaseEntity } from 'src/types/BaseEntity';

export class Worker extends BaseEntity {
    name: string;
    cpuMemory: number;
    hasGPU: boolean;
    gpuModel: string | null;
    gpuMemory: number | null;
    cpuCores: number;
    cpuModel: string;
    storage: number;
    lastSeen: Date;
    reachable: boolean;

    constructor(
        uuid: string,
        name: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
        cpuMemory: number,
        hasGPU: boolean,
        gpuModel: string | null,
        gpuMemory: number | null,
        cpuCores: number,
        cpuModel: string,
        storage: number,
        lastSeen: string,
        reachable: boolean,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.name = name;
        this.cpuMemory = cpuMemory;
        this.hasGPU = hasGPU;
        this.gpuModel = gpuModel;
        this.gpuMemory = gpuMemory;
        this.cpuCores = cpuCores;
        this.cpuModel = cpuModel;
        this.storage = storage;
        this.lastSeen = new Date(lastSeen);
        this.reachable = reachable;
    }
}
