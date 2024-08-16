export type HardwareRequirements = {
    needs_gpu: boolean;
};

export type ActionDetails = {
    mission_action_id: string;
    hardware_requirements: HardwareRequirements;
};
