import { ApiProperty } from '@nestjs/swagger';
import {
    IsBoolean,
    IsDate,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaggedResponse } from './pagged-response';

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
    @IsString()
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

export class ActionWorkersDto implements PaggedResponse<ActionWorkerDto> {
    @ApiProperty()
    @ValidateNested({ each: true })
    @Type(() => ActionWorkerDto)
    data!: ActionWorkerDto[];

    @ApiProperty()
    @IsNumber()
    count!: number;

    @ApiProperty()
    @IsNumber()
    skip!: number;

    @ApiProperty()
    @IsNumber()
    take!: number;
}
