import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** Body of `POST /users/promote` and `POST /users/demote`. */
export class ChangeUserRoleDto {
    @ApiProperty({
        description: 'Email address of the user whose role changes',
        example: 'jane.doe@example.com',
    })
    @IsEmail()
    email!: string;
}
