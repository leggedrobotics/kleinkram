import { UserDto } from '@api-dto/user/user.dto';
import { ActionState } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsDate,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';

/**
 * One change of an action's state, and why it happened.
 */
export class ActionStateTransitionDto {
    @ApiProperty()
    @IsUUID()
    uuid!: string;

    @ApiProperty({ enum: ActionState })
    @IsEnum(ActionState)
    state!: ActionState;

    @ApiProperty({
        nullable: true,
        description:
            'Machine-readable cause, an ActionStateCause. Treat as an open set: clients must fall back to `cause` for codes they do not know.',
    })
    @IsOptional()
    @IsString()
    causeCode!: string | null;

    @ApiProperty({ description: 'Why the action changed state, as text.' })
    @IsString()
    cause!: string;

    @ApiProperty({
        nullable: true,
        type: () => UserDto,
        description: 'The user who caused the change, e.g. who cancelled.',
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => UserDto)
    actor!: UserDto | null;

    @ApiProperty()
    @IsDate()
    createdAt!: Date;
}

export class ActionStateHistoryDto {
    @ApiProperty({ type: () => [ActionStateTransitionDto] })
    @ValidateNested({ each: true })
    @Type(() => ActionStateTransitionDto)
    data!: ActionStateTransitionDto[];
}
