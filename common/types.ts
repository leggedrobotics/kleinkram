export type HardwareRequirements = {
    needs_gpu: boolean;
};

export type ActionDetails = {
    action_uuid: string;
    hardware_requirements: HardwareRequirements;
};
