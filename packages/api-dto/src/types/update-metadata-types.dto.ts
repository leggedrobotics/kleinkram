import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { IsAtLeastOnePresent } from './tags/add-tags.dto';

/**
 * Body of `PUT /projects/:uuid/metadata-types`.
 *
 * The endpoint replaces the project's *full* set of required metadata types,
 * so at least one of the two fields has to be present (if both are given,
 * the canonical `metadataTypeUUIDs` wins): a body naming neither
 * (`{}`, or one that only carries a misspelled key) would otherwise read as
 * "clear every required metadata type". An explicit empty array is still
 * accepted, since clearing on purpose is a valid request.
 */
@IsAtLeastOnePresent(['metadataTypeUUIDs', 'tagTypeUUIDs'])
export class UpdateMetadataTypesBodyDto {
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    @ApiProperty({
        required: false,
        type: [String],
        description:
            'Deprecated alias for metadataTypeUUIDs. Ignored when ' +
            'metadataTypeUUIDs is given.',
    })
    tagTypeUUIDs?: string[];

    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    @ApiProperty({
        required: false,
        type: [String],
        description:
            'The complete new set of required metadata types. Pass an empty ' +
            'array to clear them.',
    })
    metadataTypeUUIDs?: string[];
}

export class UpdateMetadataTypesDto {
    @ApiProperty()
    @IsBoolean()
    success!: boolean;
}
