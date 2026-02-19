import { ActionState } from '@kleinkram/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsUUID } from 'class-validator';

export class WebhookTriggerResponseDto {
    @ApiProperty()
    @IsUUID()
    actionUUID!: string;

    @ApiProperty()
    @IsUUID()
    templateUUID!: string;

    @ApiProperty({ enum: ActionState })
    @IsEnum(ActionState)
    state!: ActionState;

    @ApiProperty()
    @IsDateString()
    createdAt!: string;
}
