import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAccessGroupDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({description: 'Name of the access group'})
    name: string;

}