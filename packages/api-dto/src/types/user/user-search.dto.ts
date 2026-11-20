import { UserDto } from '@api-dto/user/user.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

/**
 * A user found by the user search. `email` is only set when the requester
 * may see it; `emailHint` tells users apart in pickers either way.
 */
export class UserSearchResultDto extends UserDto {
    @ApiProperty({
        description:
            'The email address if the requester may see it (exact match or ' +
            'a shared affiliation group), otherwise a masked form such as ' +
            '"d•••••@ethz.ch". Null if the user has no email address.',
        nullable: true,
        required: false,
        type: String,
    })
    @IsOptional()
    @IsString()
    @Expose()
    emailHint?: string | null;
}

export class UserSearchResultsDto {
    @ApiProperty({
        type: () => [UserSearchResultDto],
        description: 'List of users',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UserSearchResultDto)
    users!: UserSearchResultDto[];

    @ApiProperty()
    @IsNumber()
    count!: number;
}
