import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { IsSkip } from '../../validation/skip-validation';
import { IsTake } from '../../validation/take-validation';
import { Paginated } from './pagination';

export class ActionWorkerDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty()
    @IsString()
    identifier!: string;

    @ApiProperty()
    @IsString()
    hostname!: string;

    @ApiProperty()
    @IsNumber()
    cpuMemory!: number;

    @ApiProperty()
    @IsString()
    gpuModel!: string;

    @ApiProperty()
    @IsNumber()
    gpuMemory!: number;

    @ApiProperty()
    @IsNumber()
    cpuCores!: number;

    @ApiProperty()
    @IsString()
    cpuModel!: string;

    @ApiProperty()
    @IsNumber()
    storage!: number;

    @ApiProperty()
    @IsDate()
    lastSeen!: Date;

    @ApiProperty()
    @IsBoolean()
    reachable!: boolean;
}

export class ActionWorkersDto implements Paginated<ActionWorkerDto> {
    @ApiProperty({
        type: [ActionWorkerDto],
        description: 'List of action workers',
    })
    @ValidateNested({ each: true })
    @Type(() => ActionWorkerDto)
    data!: ActionWorkerDto[];

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
