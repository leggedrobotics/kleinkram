import { ProjectDto } from '@api-dto/project/base-project.dto';
import { UserDto } from '@api-dto/user/user.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

@Expose()
export class ProjectWithCreator extends ProjectDto {
    @ApiProperty()
    @ValidateNested()
    @Type(() => UserDto)
    @Expose()
    creator!: UserDto;
}
