import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

@Expose()
export class ProjectDto {
    @ApiProperty()
    @IsUUID()
    @Expose()
    uuid!: string;

    @ApiProperty()
    @IsString()
    @Expose()
    name!: string;

    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    @Expose()
    updatedAt!: Date;

    @ApiProperty()
    @IsString()
    @Expose()
    description!: string;

    @ApiProperty()
    @IsBoolean()
    @Expose()
    autoConvert!: boolean;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    @Expose()
    autoRecoverMcap?: boolean;
}
