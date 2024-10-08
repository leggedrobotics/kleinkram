import { RuntimeDescription } from '@common/types';

export class HardwareDependencyError extends Error {
    constructor(
        public readonly hardware_requirements: RuntimeDescription,
        public readonly hardware_capabilities: RuntimeDescription,
    ) {
        super(
            `Hardware requirements not met. Required: ${JSON.stringify(
                hardware_requirements,
            )}, Available: ${JSON.stringify(hardware_capabilities)}`,
        );
        this.name = 'DependencyNotMetError';
    }
}
