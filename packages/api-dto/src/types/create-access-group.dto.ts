import { IsValidName } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAccessGroupDto {
    @IsString()
    @IsNotEmpty()
    @IsValidName('Group name')
    @ApiProperty({ description: 'Name of the access group' })
    name!: string;
}
