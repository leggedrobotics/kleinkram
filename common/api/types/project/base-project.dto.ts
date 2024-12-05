import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserDto } from '../User.dto';

export class ProjectDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;

    @ApiProperty()
    @IsDate()
    updatedAt!: Date;

    @ApiProperty()
    @IsString()
    description!: string;
}

export class ProjectWithCreator extends ProjectDto {
    @ApiProperty()
    @ValidateNested()
    @Type(() => UserDto)
    creator!: UserDto;
}
