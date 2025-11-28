import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../../api/types/user/user.dto';

export class UsersDto {
    @ApiProperty({
        type: () => [UserDto],
        description: 'List of users',
    })
    users!: UserDto[];

    @ApiProperty()
    count!: number;
}
