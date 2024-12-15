import { DECORATORS } from '@nestjs/swagger/dist/constants';

export const metadataApplier = (
    parameterName: string,
    parameterDescription: string,
    parameterType: string,
    parameterDatatype: string,
    parameterRequired: boolean,
    format?: string,
) => [
    (target, key) => {
        // Here we will define query parameter for swagger documentation
        const explicit =
            Reflect.getMetadata(DECORATORS.API_PARAMETERS, target[key]) ?? [];
        Reflect.defineMetadata(
            DECORATORS.API_PARAMETERS,
            [
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
            target[key],
        );
    },
];
