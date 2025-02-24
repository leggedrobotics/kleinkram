import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class DockerImageDto {
    @ApiProperty()
    @IsArray()
    @IsString({ each: true })
    repoDigests!: string[];

    @ApiProperty({ description: 'SHA value', required: false })
    @IsOptional()
    @IsString()
    sha!: string;
}
