import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { AccessGroupRights } from '../../../frontend_shared/enum';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';
import { Paginated } from '../pagination';

export class ActionTemplateDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsString()
    imageName!: string;

    @ApiProperty()
    @IsString()
    command!: string;

    @ApiProperty()
    @IsString()
    entrypoint!: string;

    @ApiProperty()
    @IsEnum(AccessGroupRights)
    accessRights!: AccessGroupRights;

    @ApiProperty()
    @IsNumber()
    gpuMemory!: number;

    @ApiProperty()
    @IsNumber()
    cpuMemory!: number;

    @ApiProperty()
    @IsNumber()
    cpuCores!: number;

    @ApiProperty()
    @IsString()
    version!: string;

    @ApiProperty()
    @IsNumber()
    maxRuntime!: number;
}

export class ActionTemplatesDto implements Paginated<ActionTemplateDto> {
    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty({
        type: () => [ActionTemplateDto],
        description: 'List of templates',
    })
    @ValidateNested({ each: true })
    @Type(() => ActionTemplateDto)
    data!: ActionTemplateDto[];

    @ApiProperty()
    @IsSkip()
    skip!: number;

    @ApiProperty()
    @IsTake()
    take!: number;
}
