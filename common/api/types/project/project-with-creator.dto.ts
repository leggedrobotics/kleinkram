import { ApiProperty } from '@nestjs/swagger';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserDto } from '../user.dto';
import { ProjectDto } from './base-project.dto';

export class ProjectWithCreator extends ProjectDto {
    @ApiProperty()
    @ValidateNested()
    @Type(() => UserDto)
    creator!: UserDto;
}
