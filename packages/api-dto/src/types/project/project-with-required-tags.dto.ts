/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { ProjectWithCreator } from '@api-dto/project/project-with-creator.dto';
import { TagTypeDto } from '@api-dto/tags/tags.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type, plainToInstance } from 'class-transformer';
import { IsBoolean, IsNumber, ValidateNested } from 'class-validator';

@Expose()
export class ProjectWithRequiredTagsDto extends ProjectWithCreator {
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
        type: () => [TagTypeDto],
        description: 'List of required tags',
    })
    @ValidateNested()
    @Type(() => TagTypeDto)
    @Expose()
    @Transform(({ value, obj }) => {
        const tags = (obj.requiredTags ?? value ?? []) as object[];
        return tags.map((tag) =>
            plainToInstance(TagTypeDto, tag, { excludeExtraneousValues: true }),
        );
    })
    requiredTags!: TagTypeDto[];
}
