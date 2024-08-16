type GPUModel = {
    name: string;
    memory: number;
    compute_capability: string;
};

type RuntimeDescription = {
    gpu_model: GPUModel | null;
};
export type RuntimeCapability = RuntimeDescription;
export type RuntimeRequirements = RuntimeDescription;

export type ActionSubmissionDetails = {
    action_uuid: string;
    runtime_requirements: RuntimeRequirements;
};
