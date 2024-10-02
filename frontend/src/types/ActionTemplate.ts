import { User } from 'src/types/User';
import { BaseEntity } from 'src/types/BaseEntity';

type GPUModel = {
    name: string;
    memory: number;
    compute_capability: string;
};
type RuntimeRequirements = {
    gpu_model?: GPUModel | null;
    cpu_model?: string | null;
    memory?: number | null;
};

export class ActionTemplate extends BaseEntity {
    image_name: string;
    createdBy: User;
    name: string;
    version: number;
    runtime_requirements: RuntimeRequirements;
    command: string;

    constructor(
        uuid: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        deletedAt: Date | null,
        image_name: string,
        createdBy: User,
        name: string,
        version: number,
        command: string,
        runtime_requirements: RuntimeRequirements,
    ) {
        super(uuid, createdAt, updatedAt, deletedAt);
        this.image_name = image_name;
        this.version = version;
        this.createdBy = createdBy;
        this.name = name;
        this.runtime_requirements = runtime_requirements;
        this.command = command;
    }

    clone(): ActionTemplate {
        const existing_gpu_model = this.runtime_requirements.gpu_model;
        const runtime_requirements = {
            gpu_model: {
                name: existing_gpu_model.name,
                memory: existing_gpu_model.memory,
                compute_capability: existing_gpu_model.compute_capability,
            },
            cpu_model: this.runtime_requirements.cpu_model,
            memory: this.runtime_requirements.memory,
        };
        return new ActionTemplate(
            this.uuid,
            this.createdAt,
            this.updatedAt,
            this.deletedAt,
            this.image_name,
            this.createdBy,
            this.name,
            this.version,
            this.command,
            runtime_requirements,
        );
    }
}
