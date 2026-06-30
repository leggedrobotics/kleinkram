import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { IsAtLeastOnePresent } from './tags/add-tags.dto';

@IsAtLeastOnePresent(['metadataTypeUUID', 'tagTypeUUID'])
export class AddMetadataTypeQueryDto {
    @IsOptional()
    @IsUUID('4')
    @ApiProperty({ required: false })
    tagTypeUUID?: string;

    @IsOptional()
    @IsUUID('4')
    @ApiProperty({ required: false })
    metadataTypeUUID?: string;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AddMetadataTypeDto {}
