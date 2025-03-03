import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ProjectDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty()
    @IsString()
    description!: string;

    @ApiProperty()
    @IsBoolean()
    autoConvert!: boolean;
}
