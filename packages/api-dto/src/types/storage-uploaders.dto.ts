import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsDate,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

/** One user's stored files; names only, never the email address */
export class StorageUploaderDto {
    @ApiProperty()
    @IsString()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsNumber()
    bytes!: number;

    @ApiProperty()
    @IsNumber()
    fileCount!: number;

    @ApiProperty({ description: 'When the user last uploaded a stored file' })
    @Type(() => Date)
    @IsDate()
    lastUploadAt!: Date;
}

export class StorageOtherUploadersDto {
    @ApiProperty()
    @IsNumber()
    bytes!: number;

    @ApiProperty()
    @IsNumber()
    userCount!: number;
}

/** Stored data per user who uploaded it (admins only) */
export class StorageUploadersDto {
    @ApiProperty({
        type: () => [StorageUploaderDto],
        description: 'The 8 users with the most stored data',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StorageUploaderDto)
    uploaders!: StorageUploaderDto[];

    @ApiProperty({
        type: () => StorageOtherUploadersDto,
        nullable: true,
        description: 'All other users together, null if there are none',
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => StorageOtherUploadersDto)
    other!: StorageOtherUploadersDto | null;

    @ApiProperty({ description: 'Bytes of all stored files' })
    @IsNumber()
    totalBytes!: number;
}
