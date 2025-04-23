import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SubmitActionDto {
    @IsUUID()
    @ApiProperty()
    missionUUID!: string;

    @IsUUID()
    @ApiProperty()
    templateUUID!: string;
}

export class ActionSubmitResponseDto {
    @ApiProperty()
    @IsUUID()
    actionUUID!: string;
}
