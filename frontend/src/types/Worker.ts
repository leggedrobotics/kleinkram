import { BaseEntity } from 'src/types/BaseEntity';

export class Worker extends BaseEntity {
    identifier: string;
    hostname: string;
    cpuMemory: number;
    gpuModel: string | null;
    gpuMemory: number | null;
    cpuCores: number;
    cpuModel: string;
    storage: number;
    lastSeen: Date;
    reachable: boolean;

    constructor(
        uuid: string,
        identifier: string,
        hostname: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        cpuMemory: number,
        gpuModel: string | null,
        gpuMemory: number | null,
        cpuCores: number,
        cpuModel: string,
        storage: number,
        lastSeen: string,
        reachable: boolean,
    ) {
        super(uuid, createdAt, updatedAt);
        this.identifier = identifier;
        this.hostname = hostname;
        this.cpuMemory = cpuMemory;
        this.gpuModel = gpuModel;
        this.gpuMemory = gpuMemory;
        this.cpuCores = cpuCores;
        this.cpuModel = cpuModel;
        this.storage = storage;
        this.lastSeen = new Date(lastSeen);
        this.reachable = reachable;
    }
}
