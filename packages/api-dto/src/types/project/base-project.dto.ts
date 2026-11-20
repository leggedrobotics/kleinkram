import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsDate, IsString, IsUUID } from 'class-validator';

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
        description:
            'Whether the Foxglove preview tab is shown in the missions of this project',
    })
    @IsBoolean()
    @Expose()
    foxglovePreviewEnabled!: boolean;
}
