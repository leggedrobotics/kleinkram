import { IsNotUndefined } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class UserDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty()
    @IsString()
    name!: string;

    @ApiProperty()
    @IsNotUndefined()
    @IsOptional()
    @IsString()
    avatarUrl!: string | null;

    @ApiProperty({
        description:
            'Email address of the user. Set to null if not available or not accessible.',
        nullable: true,
        required: false,
    })
    @IsNotUndefined()
    @IsOptional()
    @IsEmail()
    email!: string | null;
}
