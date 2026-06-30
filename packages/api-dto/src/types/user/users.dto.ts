import { UserDto } from '@api-dto/user/user.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, ValidateNested } from 'class-validator';

export class UsersDto {
    @ApiProperty({
        type: () => [UserDto],
        description: 'List of users',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UserDto)
    users!: UserDto[];

    @ApiProperty()
    @IsNumber()
    count!: number;
}
