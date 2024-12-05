import { ApiProperty } from '@nestjs/swagger';
import { PaggedResponse } from './pagged-response';
import { IsSkip } from '../../validation/skip-validation';
import { IsTake } from '../../validation/take-validation';
import {
    IsDate,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ResentProjectDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsString()
    description!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;
}

export class ResentProjectsDto implements PaggedResponse<ResentProjectDto> {
    @ApiProperty({
        name: 'data',
        description: 'List of resent projects',
        type: ResentProjectDto,
    })
    @ValidateNested()
    @Type(() => ResentProjectDto)
    data!: ResentProjectDto[];

    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
