import { ProjectArchiveState } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

@Expose()
export class ProjectDto {
    @ApiProperty()
    @IsUUID()
    @Expose()
    uuid!: string;

    @ApiProperty()
    @IsString()
    @Expose()
    name!: string;

    @ApiProperty()
    @IsDate()
    @Expose()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    @Expose()
    updatedAt!: Date;

    @ApiProperty()
    @IsString()
    @Expose()
    description!: string;

    @ApiProperty()
    @IsBoolean()
    @Expose()
    autoConvert!: boolean;

    @ApiProperty({
        enum: ProjectArchiveState,
        required: false,
        description:
            'Where the data of the project lives. Anything but ACTIVE makes ' +
            'the project read-only; missing means ACTIVE.',
    })
    @IsOptional()
    @IsEnum(ProjectArchiveState)
    @Expose()
    archiveState?: ProjectArchiveState;
}
