/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-condition */
import { IsNotUndefined } from '@kleinkram/validation';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
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
    @Transform(({ value }) => value ?? null)
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
    @Transform(({ obj, options }) => {
        return options?.groups?.includes('includeEmail') && obj.email
            ? obj.email
            : null;
    })
    email!: string | null;
}
