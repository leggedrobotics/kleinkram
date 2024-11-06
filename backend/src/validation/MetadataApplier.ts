import { DECORATORS } from '@nestjs/swagger/dist/constants';

export const metadataApplier = (paramName: string, paramDescription: string, paramType:string, paramDatatype: string, paramRequired: boolean, format?: string)=>[(target, key) => {
    // Here we will define query parameter for swagger documentation
    const explicit = Reflect.getMetadata(DECORATORS.API_PARAMETERS, target[key]) ?? [];
    Reflect.defineMetadata(DECORATORS.API_PARAMETERS, [
        ...explicit,
        {
            description: paramDescription,
            in: paramType,
            name: paramName,
            required: paramRequired,
            type: paramDatatype,
            format
        }
    ], target[key]);
}];