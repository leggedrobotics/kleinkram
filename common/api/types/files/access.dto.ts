import { ApiProperty } from '@nestjs/swagger';
import {
    IsBoolean,
    IsNumber,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaggedResponse } from '../pagged-response';
import { IsSkip } from '../../../validation/skip-validation';
import { IsTake } from '../../../validation/take-validation';

export class AccessCredentialsDto {
    @ApiProperty()
    @IsString()
    accessKey!: string;

    @ApiProperty()
    @IsString()
    secretKey!: string;

    @ApiProperty()
    @IsString()
    sessionToken!: string;
}

export class TemporaryFileAccessDto {
    @ApiProperty()
    @IsString()
    bucket!: string;

    @ApiProperty()
    @IsUUID()
    fileUUID!: string;

    @ApiProperty()
    @IsString()
    fileName!: string;

    @ApiProperty()
    @ValidateNested()
    @Type(() => AccessCredentialsDto)
    accessCredentials!: AccessCredentialsDto;

    @ApiProperty()
    @IsString()
    queueUUID!: string;
}

export class TemporaryFileAccessesDto
    implements PaggedResponse<TemporaryFileAccessDto>
{
    @ApiProperty({
        type: [TemporaryFileAccessDto],
        description: 'List of temporary file accesses',
    })
    @ValidateNested({ each: true })
    @Type(() => TemporaryFileAccessDto)
    data!: TemporaryFileAccessDto[];

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

export class FileExistsResponseDto {
    @ApiProperty()
    @IsBoolean()
    exists!: boolean;

    @ApiProperty()
    @IsUUID()
    uuid!: string;
}
