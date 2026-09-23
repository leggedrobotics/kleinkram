/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { MetadataTypeDto } from '@api-dto/metadata/metadata.dto';
import { ProjectWithCreator } from '@api-dto/project/project-with-creator.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type, plainToInstance } from 'class-transformer';
import { IsBoolean, IsNumber, ValidateNested } from 'class-validator';

const toMetadataTypeDtos = (
    project: { requiredMetadataTypes?: object[] },
    value: unknown,
): MetadataTypeDto[] => {
    const metadataTypes = (project.requiredMetadataTypes ??
        value ??
        []) as object[];
    return metadataTypes.map((metadataType) =>
        plainToInstance(MetadataTypeDto, metadataType, {
            excludeExtraneousValues: true,
        }),
    );
};

@Expose()
export class ProjectWithRequiredMetadataTypesDto extends ProjectWithCreator {
    @ApiProperty({
        description: 'Number of missions',
    })
    @IsNumber()
    @Expose()
    @Transform(({ obj }) => obj.missionCount ?? 0)
    missionCount!: number;

    @ApiProperty({
        description: 'Total size of files in byte',
    })
    @IsNumber()
    @Expose()
    @Transform(({ obj }) => obj.size ?? 0)
    size!: number;

    @ApiProperty({
        description:
            'Whether the requesting user has starred this project. Always ' +
            'false for requests that are not made on behalf of a user.',
    })
    @IsBoolean()
    @Expose()
    @Transform(({ obj }) => obj.isStarred ?? false)
    isStarred!: boolean;

    @ApiProperty({
        description:
            'Whether the project is public, i.e. every user can read it ' +
            'without being a member of one of its access groups.',
    })
    @IsBoolean()
    @Expose()
    @Transform(({ obj }) => obj.isPublic ?? false)
    isPublic!: boolean;

    @ApiProperty({
        type: () => [MetadataTypeDto],
        description: 'Metadata types every mission of the project must set',
    })
    @ValidateNested()
    @Type(() => MetadataTypeDto)
    @Expose()
    @Transform(({ value, obj }) => toMetadataTypeDtos(obj, value))
    requiredMetadataTypes!: MetadataTypeDto[];

    @ApiProperty({
        type: () => [MetadataTypeDto],
        description: 'Deprecated alias for requiredMetadataTypes.',
        deprecated: true,
    })
    @ValidateNested()
    @Type(() => MetadataTypeDto)
    @Expose()
    @Transform(({ value, obj }) => toMetadataTypeDtos(obj, value))
    requiredTags!: MetadataTypeDto[];
}
