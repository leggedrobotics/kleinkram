import { UserDto } from '@common/api/types/user/user.dto';
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
