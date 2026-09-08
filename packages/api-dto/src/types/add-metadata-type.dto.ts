import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { IsAtLeastOnePresent } from './tags/add-tags.dto';

/**
 * Query parameters of `POST /projects/:uuid/metadata-types`.
 *
 * At least one of the two has to be present; without a type uuid there is
 * nothing to add, so the request is rejected with 400 instead of reaching the
 * service with a placeholder value.
 */
@IsAtLeastOnePresent(['metadataTypeUUID', 'tagTypeUUID'])
export class AddMetadataTypeQueryDto {
    @IsOptional()
    @IsUUID('4')
    @ApiProperty({
        required: false,
        description:
            'Deprecated alias for metadataTypeUUID. Ignored when ' +
            'metadataTypeUUID is given.',
    })
    tagTypeUUID?: string;

    @IsOptional()
    @IsUUID('4')
    @ApiProperty({
        required: false,
        description: 'The metadata type to add to the project.',
    })
    metadataTypeUUID?: string;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AddMetadataTypeDto {}
