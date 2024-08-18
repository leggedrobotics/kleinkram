type GPUModel = {
    name: string;
    memory: number;
    compute_capability: string;
};

type RuntimeDescription = {
    gpu_model?: GPUModel | null;
    cpu_model?: string | null;
};
export type RuntimeCapability = RuntimeDescription;
export type RuntimeRequirements = RuntimeDescription;
