import { ApiProperty } from '@nestjs/swagger';
import {IsArray, IsOptional, IsString} from 'class-validator';

export class DockerImageDto {
    @ApiProperty({ type: [String] })
    @IsArray()
    @IsString({ each: true })
    repoDigests!: string[];

    @ApiProperty()
    @IsString()
    @IsOptional()
    sha!: string;
}
