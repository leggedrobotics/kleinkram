import { ProjectDto } from '@api-dto/project/base-project.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export class ProjectWithCreator extends ProjectDto {
    @ApiProperty()
    @ValidateNested()
    @Type(() => UserDto)
    creator!: UserDto;
}
