import { RuntimeCapability, RuntimeRequirements } from '@common/types';

export class HardwareDependencyError extends Error {
    constructor(
        public readonly hardware_requirements: RuntimeRequirements,
        public readonly hardware_capabilities: RuntimeCapability,
    ) {
        super(
            `Hardware requirements not met. Required: ${JSON.stringify(
                hardware_requirements,
            )}, Available: ${JSON.stringify(hardware_capabilities)}`,
        );
        this.name = 'DependencyNotMetError';
    }
}
