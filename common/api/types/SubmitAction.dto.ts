import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitActionDto {
    @IsUUID()
    @ApiProperty()
    missionUUID: string;

    @IsUUID()
    @ApiProperty()
    templateUUID: string;
}

export class ActionSubmitResponseDto {
    @ApiProperty()
    actionUUID: string;
}
