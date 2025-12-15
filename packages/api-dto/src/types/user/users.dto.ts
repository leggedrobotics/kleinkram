import { UserDto } from '@api-dto/user/user.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UsersDto {
    @ApiProperty({
        type: () => [UserDto],
        description: 'List of users',
    })
    users!: UserDto[];

    @ApiProperty()
    count!: number;
}
