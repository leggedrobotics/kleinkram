import { User } from 'src/types/User';
import { BaseEntity } from 'src/types/BaseEntity';

export class ActionTemplate extends BaseEntity {
    imageName: string;
    createdBy: User;
    name: string;
    version: number;
    cpuCores: number;
    cpuMemory: number;
    gpuMemory: number;
    maxRuntime: number;
    command: string;

    constructor(
        uuid: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        imageName: string,
        createdBy: User,
        name: string,
        version: number,
        command: string,
        cpuCores: number,
        cpuMemory: number,
        gpuMemory: number,
        maxRuntime: number,
    ) {
        super(uuid, createdAt, updatedAt);
        this.imageName = imageName;
        this.version = version;
        this.createdBy = createdBy;
        this.name = name;
        this.command = command;
        this.cpuCores = cpuCores;
        this.cpuMemory = cpuMemory;
        this.gpuMemory = gpuMemory;
        this.maxRuntime = maxRuntime;
    }

    clone(): ActionTemplate {
        return new ActionTemplate(
            this.uuid,
            this.createdAt,
            this.updatedAt,
            this.imageName,
            this.createdBy,
            this.name,
            this.version,
            this.command,
            this.cpuCores,
            this.cpuMemory,
            this.gpuMemory,
            this.maxRuntime,
        );
    }
}
