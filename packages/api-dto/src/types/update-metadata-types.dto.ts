import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { IsAtLeastOnePresent } from './tags/add-tags.dto';

@IsAtLeastOnePresent(['metadataTypeUUIDs', 'tagTypeUUIDs'])
export class UpdateMetadataTypesBodyDto {
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    @ApiProperty({ required: false, type: [String] })
    tagTypeUUIDs?: string[];

    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    @ApiProperty({ required: false, type: [String] })
    metadataTypeUUIDs?: string[];
}

export class UpdateMetadataTypesDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;
}
