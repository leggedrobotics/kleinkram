import { DECORATORS } from '@nestjs/swagger/dist/constants';

export const metadataApplier = (
    parameterName: string,
    parameterDescription: string,
    parameterType: string,
    parameterDatatype: string,
    parameterRequired: boolean,
    format?: string,
) => [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (target: any, key: string | symbol | undefined) => {
        if (!key) {
            return;
        }
        // Here we will define query parameter for swagger documentation
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const explicit =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            Reflect.getMetadata(DECORATORS.API_PARAMETERS, target[key]) ?? [];
        Reflect.defineMetadata(
            DECORATORS.API_PARAMETERS,
            [
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...explicit,
                {
                    description: parameterDescription,
                    in: parameterType,
                    name: parameterName,
                    required: parameterRequired,
                    type: parameterDatatype,
                    format,
                },
            ],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            target[key],
        );
    },
];
