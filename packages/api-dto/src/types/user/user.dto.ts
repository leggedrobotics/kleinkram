import { IsNotUndefined } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

@Expose()
export class UserDto {
    @ApiProperty()
    @IsUUID()
    @Expose()
    uuid!: string;

    @ApiProperty()
    @IsString()
    @Expose()
    name!: string;

    @ApiProperty()
    @IsNotUndefined()
    @IsOptional()
    @IsString()
    @Expose()
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
    @Expose()
    email!: string | null;
}
