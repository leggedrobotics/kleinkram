import { RuntimeDescription } from '@common/types';

export class HardwareDependencyError extends Error {
    constructor(
        public readonly hardwareRequirements: RuntimeDescription,
        public readonly hardwareCapabilities: RuntimeDescription,
    ) {
        super(
            `Hardware requirements not met. Required: ${JSON.stringify(
                hardwareRequirements,
            )}, Available: ${JSON.stringify(hardwareCapabilities)}`,
        );
        this.name = 'DependencyNotMetError';
    }
}
