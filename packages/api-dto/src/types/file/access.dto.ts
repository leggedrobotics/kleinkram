import { Paginated } from '@api-dto/pagination';
import { IsSkip, IsTake } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

export class AccessCredentialsDto {
    @ApiProperty()
    @IsString()
    accessKey!: string;

    @ApiProperty()
    @IsString()
    secretKey!: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    sessionToken?: string;
}

export class TemporaryFileAccessDto {
    @ApiProperty()
    @IsString()
    @IsOptional()
    bucket!: string | null;

    @ApiProperty()
    @IsUUID()
    @IsOptional()
    fileUUID!: string | null;

    /**
     * Object key the upload has to be written to.
     *
     * It is not the key the file is served from: the credentials are scoped
     * to this key alone, and confirming the upload moves the object off it so
     * that they can no longer reach the validated bytes. Clients that predate
     * this field upload to `fileUUID` instead and are not protected that way.
     */
    @ApiProperty()
    @IsString()
    @IsOptional()
    objectKey?: string | null;

    @ApiProperty()
    @IsString()
    fileName!: string;

    @ApiProperty()
    @ValidateNested()
    @Type(() => AccessCredentialsDto)
    @IsOptional()
    accessCredentials!: AccessCredentialsDto | null;

    @ApiProperty()
    @IsString()
    @IsOptional()
    error?: string | null;
}

export class TemporaryFileAccessesDto implements Paginated<TemporaryFileAccessDto> {
    @ApiProperty({
        type: () => [TemporaryFileAccessDto],
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
