import { IsEmpty } from 'class-validator';

export class NoQueryParametersDto {
    @IsEmpty({
        message: 'property empty should not exist',
    }) // Disallow any properties
    empty?: never; // Define no allowed fields
}
