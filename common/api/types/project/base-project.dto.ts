import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsString, IsUUID } from 'class-validator';

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
}
