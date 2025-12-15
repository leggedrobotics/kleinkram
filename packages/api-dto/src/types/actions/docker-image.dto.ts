import { ImageSource } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class DockerImageDto {
    @ApiProperty()
    @IsArray()
    @IsString({ each: true })
    repoDigests!: string[];

    @ApiProperty({ description: 'SHA value', required: false })
    @IsOptional()
    @IsString()
    sha!: string;

    @ApiProperty({
        description: 'Source of the image',
        required: false,
        enum: ImageSource,
    })
    @IsOptional()
    @IsEnum(ImageSource)
    source?: ImageSource;

    @ApiProperty({ description: 'Local creation timestamp', required: false })
    @IsOptional()
    localCreatedAt?: Date;

    @ApiProperty({ description: 'Remote creation timestamp', required: false })
    @IsOptional()
    remoteCreatedAt?: Date;
}
