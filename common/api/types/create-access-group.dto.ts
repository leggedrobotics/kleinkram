import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsValidName } from '../../../backend/src/validation/propertyDecorator';

export class CreateAccessGroupDto {
    @IsString()
    @IsNotEmpty()
    @IsValidName()
    @ApiProperty({ description: 'Name of the access group' })
    name!: string;
}
