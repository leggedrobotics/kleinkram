import { ApiProperty } from '@nestjs/swagger';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DockerImageDto {
    @ApiProperty()
    @ValidateNested()
    @Type(() => String)
    repoDigests!: string[];
}
